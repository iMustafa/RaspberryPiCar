#!/usr/bin/env python3
"""
Steering Control Module
Handles servo control for vehicle steering via Adafruit ServoKit
"""

import logging
import time
import sys

# Try to import Adafruit ServoKit for servo controller
try:
    import board
    from adafruit_servokit import ServoKit
    SERVO_KIT_AVAILABLE = True
except ImportError:
    SERVO_KIT_AVAILABLE = False
    print("Warning: Adafruit ServoKit not available. Install with: pip install adafruit-circuitpython-servokit", file=sys.stderr)
    print("Steering will run in simulation mode.", file=sys.stderr)

logger = logging.getLogger(__name__)

class SteeringController:
    """Controls the vehicle's steering servo via ServoKit"""
    
    # Steering servo ranges (calibrated safe range)
    SERVO_MIN_US = 500    # Servo absolute min pulse
    SERVO_MAX_US = 2500   # Servo absolute max pulse
    
    # Your servo's calibrated safe range
    SERVO_SAFE_MIN_PERCENT = 10.0  # Minimum safe angle (33%)
    SERVO_SAFE_MAX_PERCENT = 90.0  # Maximum safe angle (63%)
    SERVO_CENTER_PERCENT = 50.0    # Center position (48%)
    
    def __init__(self, simulate: bool = False):
        self.servo_kit = None
        self.current_steering = 0.0      # -1.0 to 1.0
        self.simulate = bool(simulate)
        
        if SERVO_KIT_AVAILABLE and not self.simulate:
            self.initialize_servo_kit()
        
        # Log steering configuration for debugging
        self.log_steering_info()
    
    def log_steering_info(self):
        """Log steering configuration for debugging"""
        logger.info("Steering Configuration:")
        logger.info(f"  Control Method: {'ServoKit via I2C' if SERVO_KIT_AVAILABLE else 'Simulation'}")
        logger.info(f"  Servo Type: 35kg servo")
        logger.info(f"  Servo Channel: 0")
        logger.info(f"  Servo Full Range: {self.SERVO_MIN_US}-{self.SERVO_MAX_US}us")
        logger.info(f"  Safe Range: {self.SERVO_SAFE_MIN_PERCENT:.1f}%-{self.SERVO_SAFE_MAX_PERCENT:.1f}%")
        logger.info(f"  Center Position: {self.SERVO_CENTER_PERCENT:.1f}%")
        logger.info(f"  Angle Range: 0-180 degrees")
    
    def initialize_servo_kit(self):
        """Initialize Adafruit ServoKit for steering control via I2C"""
        try:
            # Initialize ServoKit with 16 channels, I2C address 0x40, 50Hz frequency
            self.servo_kit = ServoKit(channels=16, i2c=board.I2C(), address=0x40, frequency=50)
            
            # Set pulse width range for the 35kg servo on channel 0 (like your working example)
            self.servo_kit.servo[0].set_pulse_width_range(1000, 2000)
            
            logger.info("ServoKit initialized successfully via I2C")
            logger.info("Steering servo on Channel 0 (35kg servo)")
        except Exception as e:
            logger.error(f"ServoKit initialization failed: {e}")
            SERVO_KIT_AVAILABLE = False
    
    def map_steering_to_angle(self, steering_value: float) -> int:
        """Map steering value (-1.0 to 1.0) to servo angle using ServoKit"""
        if abs(steering_value) < 0.05:  # Deadzone
            logger.debug(f"Steering deadzone: {steering_value:.3f} -> 90 degrees (center)")
            return 90
        
        # Map -1.0 to 1.0 to 0% to 100% (exactly like working example)
        # Swapped: -1 (left) -> 0%, 1 (right) -> 100%
        user_percent = (1.0 - steering_value) * 50.0  # Convert -1..1 to 100..0 (swapped)
        
        # Map 0-100% input to safe servo range between 33%-63% (exactly like working example)
        safe_percent = self.SERVO_SAFE_MIN_PERCENT + (
            (user_percent / 100.0) * (self.SERVO_SAFE_MAX_PERCENT - self.SERVO_SAFE_MIN_PERCENT)
        )
        
        # Convert percentage to angle (0-180 degrees)
        angle = int(safe_percent * 1.8)  # 1.8 = 180 degrees / 100%
        
        # Clamp to valid servo range
        angle = max(0, min(180, angle))
        
        logger.debug(f"Steering: {steering_value:.3f} -> {user_percent:.1f}% -> {safe_percent:.1f}% -> {angle} degrees")
        return angle
    
    def update_steering(self, steering_value: float):
        """Update steering value"""
        self.current_steering = float(steering_value)
        logger.info(f"Steering: {self.current_steering:.3f}")
    
    def apply_steering(self):
        """Apply current steering value to hardware"""
        if self.simulate or not SERVO_KIT_AVAILABLE or not self.servo_kit:
            # Simulation mode
            steering_angle = self.map_steering_to_angle(self.current_steering)
            logger.debug(f"Simulation - Steering: {steering_angle} degrees")
            return
        
        try:
            # Apply steering using ServoKit
            steering_angle = self.map_steering_to_angle(self.current_steering)
            logger.debug(f"Setting steering servo to {steering_angle} degrees (input: {self.current_steering:.3f})")
            self.servo_kit.servo[0].angle = steering_angle  # Channel 0
            
            # Log significant changes
            if abs(self.current_steering) > 0.1:
                logger.info(f"Applied - Steering: {steering_angle} degrees")
            
            # Always log steering for debugging
            if abs(self.current_steering) > 0.05:
                logger.debug(f"Steering applied: {self.current_steering:.3f} -> {steering_angle} degrees")
                
        except Exception as e:
            logger.error(f"Steering control error: {e}")
    
    def test_steering_basic(self):
        """Test basic steering servo movement using ServoKit"""
        if not SERVO_KIT_AVAILABLE or not self.servo_kit:
            logger.warning("ServoKit not available for steering test")
            return
        
        logger.info("Testing steering servo movement using ServoKit...")
        try:
            # Test positions exactly like working example: 0, 50, 100, 50
            positions = [0, 50, 100, 50]  # 0% = left, 50% = center, 100% = right
            
            for pos in positions:
                # Use exact same logic as working example
                safe_percent = self.SERVO_SAFE_MIN_PERCENT + (
                    (pos / 100.0) * (self.SERVO_SAFE_MAX_PERCENT - self.SERVO_SAFE_MIN_PERCENT)
                )
                angle = int(safe_percent * 1.8)  # Convert to degrees
                angle = max(0, min(180, angle))  # Clamp to valid range
                
                logger.info(f"Testing {pos:.0f}% -> {safe_percent:.1f}% -> {angle} degrees")
                self.servo_kit.servo[0].angle = angle  # Channel 0
                time.sleep(0.8)  # Same timing as working example
            
            logger.info("Steering test completed successfully using ServoKit")
            
        except Exception as e:
            logger.error(f"Steering test failed: {e}")
    
    def center_steering(self):
        """Center the steering servo"""
        if SERVO_KIT_AVAILABLE and self.servo_kit:
            try:
                self.servo_kit.servo[0].angle = 90  # Center position
                logger.info("Steering centered to 90 degrees")
            except Exception as e:
                logger.error(f"Error centering steering: {e}")
    
    def cleanup(self):
        """Clean up hardware resources"""
        if SERVO_KIT_AVAILABLE and self.servo_kit:
            try:
                self.center_steering()
                logger.info("Steering hardware resources cleaned up")
            except Exception as e:
                logger.error(f"Error during steering cleanup: {e}")
    
    def get_status(self):
        """Get current steering status"""
        return {
            'steering': self.current_steering,
            'servo_kit_available': SERVO_KIT_AVAILABLE,
            'servo_kit_initialized': self.servo_kit is not None
        }

