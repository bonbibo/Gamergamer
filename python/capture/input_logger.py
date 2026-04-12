"""
Keyboard and mouse input logger using pynput.

Runs non-blocking listeners. Maintains rolling state of pressed keys and mouse
position. Thread-safe snapshot can be taken at any time via `snapshot()`.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Optional, Set

try:
    from pynput import keyboard, mouse
    PYNPUT_AVAILABLE = True
except ImportError:
    PYNPUT_AVAILABLE = False


@dataclass
class InputSnapshot:
    pressed: list[str] = field(default_factory=list)
    just_pressed: list[str] = field(default_factory=list)
    just_released: list[str] = field(default_factory=list)
    mouse_x: int = 0
    mouse_y: int = 0
    mouse_dx: int = 0
    mouse_dy: int = 0
    left_click: bool = False
    right_click: bool = False


def _key_to_str(key) -> str:
    try:
        return key.char.upper() if key.char else key.name.upper()
    except AttributeError:
        return str(key).upper()


class InputLogger:
    def __init__(self):
        self._lock = threading.Lock()
        self._pressed: Set[str] = set()
        self._just_pressed: Set[str] = set()
        self._just_released: Set[str] = set()
        self._mouse_x: int = 0
        self._mouse_y: int = 0
        self._prev_mouse_x: int = 0
        self._prev_mouse_y: int = 0
        self._left_click: bool = False
        self._right_click: bool = False
        self._kb_listener: Optional[keyboard.Listener] = None
        self._mouse_listener: Optional[mouse.Listener] = None

    def start(self) -> None:
        if not PYNPUT_AVAILABLE:
            raise RuntimeError("pynput is not installed. Run: pip install pynput")
        self._kb_listener = keyboard.Listener(
            on_press=self._on_key_press,
            on_release=self._on_key_release,
        )
        self._mouse_listener = mouse.Listener(
            on_move=self._on_mouse_move,
            on_click=self._on_mouse_click,
        )
        self._kb_listener.start()
        self._mouse_listener.start()

    def stop(self) -> None:
        if self._kb_listener:
            self._kb_listener.stop()
            self._kb_listener = None
        if self._mouse_listener:
            self._mouse_listener.stop()
            self._mouse_listener = None

    def snapshot(self) -> InputSnapshot:
        """Take a point-in-time snapshot and reset the just_pressed/released sets."""
        with self._lock:
            snap = InputSnapshot(
                pressed=sorted(self._pressed),
                just_pressed=sorted(self._just_pressed),
                just_released=sorted(self._just_released),
                mouse_x=self._mouse_x,
                mouse_y=self._mouse_y,
                mouse_dx=self._mouse_x - self._prev_mouse_x,
                mouse_dy=self._mouse_y - self._prev_mouse_y,
                left_click=self._left_click,
                right_click=self._right_click,
            )
            self._just_pressed.clear()
            self._just_released.clear()
            self._prev_mouse_x = self._mouse_x
            self._prev_mouse_y = self._mouse_y
            self._left_click = False
            self._right_click = False
        return snap

    def _on_key_press(self, key) -> None:
        k = _key_to_str(key)
        with self._lock:
            if k not in self._pressed:
                self._just_pressed.add(k)
            self._pressed.add(k)

    def _on_key_release(self, key) -> None:
        k = _key_to_str(key)
        with self._lock:
            self._pressed.discard(k)
            self._just_released.add(k)

    def _on_mouse_move(self, x: int, y: int) -> None:
        with self._lock:
            self._mouse_x = x
            self._mouse_y = y

    def _on_mouse_click(self, x: int, y: int, btn, pressed: bool) -> None:
        with self._lock:
            self._mouse_x = x
            self._mouse_y = y
            if pressed:
                btn_name = str(btn).split(".")[-1]
                if btn_name == "left":
                    self._left_click = True
                elif btn_name == "right":
                    self._right_click = True
