class_name SophiaSkin extends Node3D

@onready var animation_tree = %AnimationTree
@onready var state_machine : AnimationNodeStateMachinePlayback = animation_tree.get("parameters/StateMachine/playback")
@onready var move_tilt_path : String = "parameters/StateMachine/Move/tilt/add_amount"

var run_tilt = 0.0 : set = _set_run_tilt

@export var blink = true : set = set_blink
@onready var blink_timer = %BlinkTimer
@onready var closed_eyes_timer = %ClosedEyesTimer
@onready var talk_timer = %TalkTimer
@onready var voice_player = %VoicePlayer
@onready var eye_mat = $sophia/rig/Skeleton3D/Sophia.get("surface_material_override/2")
@onready var mouth_mat = $sophia/rig/Skeleton3D/Sophia.get("surface_material_override/3")

var _mouth_smile_tex = preload("res://player/sophia_skin/model/sophia_mouth_smile_diffuse.png")
var _mouth_open_tex = preload("res://player/sophia_skin/model/sophia_mouth_open_diffuse.png")
var _is_talking := false
var _audio_driven := false

const _VOICE_BUS := "VoiceBus"
const _OPEN_THRESHOLD_DB := -30.0

func _ready():
	blink_timer.connect("timeout", func():
		eye_mat.set("uv1_offset", Vector3(0.0, 0.5, 0.0))
		closed_eyes_timer.start(0.2)
		)

	closed_eyes_timer.connect("timeout", func():
		eye_mat.set("uv1_offset", Vector3.ZERO)
		blink_timer.start(randf_range(1.0, 4.0))
		)

	talk_timer.connect("timeout", _on_talk_timer_timeout)
	voice_player.connect("finished", stop_talk)

	if AudioServer.get_bus_index(_VOICE_BUS) == -1:
		AudioServer.add_bus()
		var idx := AudioServer.bus_count - 1
		AudioServer.set_bus_name(idx, _VOICE_BUS)
		AudioServer.set_bus_send(idx, "Master")
		AudioServer.add_bus_effect(idx, AudioEffectCapture.new())
	voice_player.bus = _VOICE_BUS

func set_blink(state : bool):
	if blink == state: return
	blink = state
	if blink:
		blink_timer.start(0.2)
	else:
		blink_timer.stop()
		closed_eyes_timer.stop()

func _set_run_tilt(value : float):
	run_tilt = clamp(value, -1.0, 1.0)
	animation_tree.set(move_tilt_path, run_tilt)

func set_mouth_open(open: bool):
	mouth_mat.albedo_texture = _mouth_open_tex if open else _mouth_smile_tex

func talk():
	_is_talking = true
	set_mouth_open(true)
	talk_timer.start(randf_range(0.1, 0.2))

func talk_audio(path: String):
	var stream = load(path) as AudioStream
	if stream:
		talk_with_audio(stream)

func talk_with_audio(stream: AudioStream):
	_audio_driven = true
	_is_talking = true
	voice_player.stream = stream
	voice_player.play()

func stop_talk():
	_is_talking = false
	_audio_driven = false
	talk_timer.stop()
	voice_player.stop()
	set_mouth_open(false)

func _process(_delta):
	if not _is_talking or not _audio_driven:
		return
	var bus_idx := AudioServer.get_bus_index(_VOICE_BUS)
	var vol_db := AudioServer.get_bus_peak_volume_left_db(bus_idx, 0)
	set_mouth_open(vol_db > _OPEN_THRESHOLD_DB)

func _on_talk_timer_timeout():
	if not _is_talking:
		return
	set_mouth_open(mouth_mat.albedo_texture == _mouth_smile_tex)
	talk_timer.start(randf_range(0.1, 0.2))

func _input(event):
	if event is InputEventKey and event.pressed:
		if event.keycode == KEY_T:
			if _is_talking:
				stop_talk()
			else:
				talk_audio("res://assets/test-audio.wav")

func idle():
	state_machine.travel("Idle")

func move():
	state_machine.travel("Move")

func fall():
	state_machine.travel("Fall")

func jump():
	state_machine.travel("Jump")

func edge_grab():
	state_machine.travel("EdgeGrab")

func wall_slide():
	state_machine.travel("WallSlide")
