#!/usr/bin/env python3
"""
Vehicle Control Module
Integrates Throttle and Steering controllers and applies control frames
"""

import logging
from datetime import datetime
from typing import Dict, Any

from throttle_control import ThrottleController
from steering_control import SteeringController

logger = logging.getLogger(__name__)


class VehicleController:
    """High-level vehicle controller combining throttle and steering."""

    def __init__(self, simulate: bool = False):
        self.simulate = bool(simulate)
        self.throttle = ThrottleController(simulate=self.simulate)
        self.steering = SteeringController(simulate=self.simulate)

    def apply_control(self, frame: Dict[str, Any]):
        """Apply parsed gamepad frame to vehicle hardware.

        frame keys: sequence, timestamp_ms, throttle, steering, buttons(list), flags, reserved
        """
        if 'error' in frame:
            logger.warning(f"Invalid control frame: {frame['error']}")
            return

        # Update continuous values
        self.throttle.update_throttle(frame.get('throttle', 0.0))
        self.steering.update_steering(frame.get('steering', 0.0))

        # Apply to hardware
        self.throttle.apply_throttle()
        self.steering.apply_steering()

        # Log a concise line
        timestamp = datetime.fromtimestamp(frame.get('timestamp_ms', 0) / 1000.0).strftime('%H:%M:%S.%f')[:-3]
        logger.debug(
            f"[{timestamp}] Seq {frame.get('sequence')} Throttle {frame.get('throttle'):+.3f} Steering {frame.get('steering'):+.3f} "
            f"Btns {frame.get('buttons')}"
        )

    def stop(self):
        """Stop vehicle immediately."""
        self.throttle.stop_vehicle()
        self.steering.center_steering()

    def cleanup(self):
        """Cleanup controllers."""
        try:
            self.stop()
        finally:
            self.throttle.cleanup()
            self.steering.cleanup()

