## Handles SSE streaming from POST /chat/audio, decodes base64 PCM chunks,
## and feeds them into an AudioStreamGenerator for real-time playback.
class_name ChatStream extends Node

signal finished
signal stream_error(message: String)
signal emotion_detected(emotion: String)

@export var server_host := "localhost"
@export var server_port := 3000

const _SAMPLE_RATE := 22050.0
const _BUFFER_LENGTH := 0.5  # seconds

@onready var _player : AudioStreamPlayer = $AudioStreamPlayer

var _http_client : HTTPClient = null
var _http_request_sent := false
var _pending_message := ""
var _sse_buffer := ""
var _pcm_queue := PackedByteArray()
var _stream_playback : AudioStreamGeneratorPlayback = null
var _is_streaming := false
var _stream_done := false
var _end_delay := -1.0

func _ready() -> void:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = _SAMPLE_RATE
	gen.buffer_length = _BUFFER_LENGTH
	_player.stream = gen

func set_bus(bus_name: String) -> void:
	_player.bus = bus_name

func is_active() -> bool:
	return _is_streaming

func start(message: String) -> void:
	if _is_streaming:
		stop()
	_pending_message = message
	_is_streaming = true
	_stream_done = false
	_end_delay = -1.0
	_sse_buffer = ""
	_pcm_queue = PackedByteArray()
	_http_request_sent = false
	_http_client = HTTPClient.new()
	_http_client.connect_to_host(server_host, server_port)
	_player.play()
	_stream_playback = _player.get_stream_playback() as AudioStreamGeneratorPlayback

func stop() -> void:
	_is_streaming = false
	_stream_done = false
	_end_delay = -1.0
	if _http_client:
		_http_client.close()
		_http_client = null
	_stream_playback = null
	_sse_buffer = ""
	_pcm_queue = PackedByteArray()
	_player.stop()

func _process(delta: float) -> void:
	if not _is_streaming:
		return
	_poll_http()
	_push_pcm_frames()
	if _stream_done and _pcm_queue.is_empty():
		if _end_delay < 0.0:
			_end_delay = _BUFFER_LENGTH  # wait for generator buffer to drain
		_end_delay -= delta
		if _end_delay <= 0.0:
			stop()
			finished.emit()

func _poll_http() -> void:
	if _http_client == null:
		return
	_http_client.poll()
	var status := _http_client.get_status()
	match status:
		HTTPClient.STATUS_CONNECTED:
			if not _http_request_sent:
				_http_request_sent = true
				var body := JSON.stringify({"message": _pending_message})
				var headers := PackedStringArray([
					"Content-Type: application/json",
					"Accept: text/event-stream",
					"Content-Length: " + str(body.to_utf8_buffer().size()),
				])
				_http_client.request(HTTPClient.METHOD_POST, "/chat/audio", headers, body)
		HTTPClient.STATUS_BODY:
			var chunk := _http_client.read_response_body_chunk()
			if chunk.size() > 0:
				_sse_buffer += chunk.get_string_from_utf8()
				_parse_sse_buffer()
		HTTPClient.STATUS_CONNECTION_ERROR, HTTPClient.STATUS_CANT_CONNECT, \
		HTTPClient.STATUS_CANT_RESOLVE, HTTPClient.STATUS_DISCONNECTED:
			if not _stream_done:
				stop()
				stream_error.emit("Connection failed (status %d)" % status)

func _parse_sse_buffer() -> void:
	_sse_buffer = _sse_buffer.replace("\r\n", "\n")
	while "\n\n" in _sse_buffer:
		var idx := _sse_buffer.find("\n\n")
		var event := _sse_buffer.substr(0, idx).strip_edges()
		_sse_buffer = _sse_buffer.substr(idx + 2)
		if not event.begins_with("data: "):
			continue
		var payload := event.substr(6)
		if payload == "[DONE]":
			_stream_done = true
			if _http_client:
				_http_client.close()
				_http_client = null
			return
		# Check for emotion JSON event
		var json := JSON.new()
		if json.parse(payload) == OK:
			var data = json.get_data()
			if data is Dictionary and data.get("type") == "emotion":
				emotion_detected.emit(data.get("value", "neutral"))
			return
		_pcm_queue.append_array(Marshalls.base64_to_raw(payload))

func _push_pcm_frames() -> void:
	if _stream_playback == null or _pcm_queue.is_empty():
		return
	var frames_available := _stream_playback.get_frames_available()
	if frames_available <= 0:
		return
	# Mono 16-bit LE PCM: 2 bytes per sample → Vector2(L, R) stereo frame
	var samples := min(_pcm_queue.size() / 2, frames_available)
	if samples <= 0:
		return
	var frames := PackedVector2Array()
	frames.resize(samples)
	for i in range(samples):
		var raw := _pcm_queue[i * 2] | (_pcm_queue[i * 2 + 1] << 8)
		if raw >= 32768:
			raw -= 65536
		var s := float(raw) / 32768.0
		frames[i] = Vector2(s, s)
	_stream_playback.push_buffer(frames)
	_pcm_queue = _pcm_queue.slice(samples * 2)
