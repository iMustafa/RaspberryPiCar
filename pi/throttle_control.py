#!/usr/bin/env python3
"""
Throttle Control Module
Handles ESC motor control for vehicle throttle
"""

import logging
import time
import sys

# Try to import pigpio for hardware control
try:
    import pigpio
    HARDWARE_AVAILABLE = True
except ImportError:
    HARDWARE_AVAILABLE = False
    print("Warning: pigpio not available. Install with: sudo apt-get install -y pigpio && sudo systemctl enable --now pigpiod", file=sys.stderr)
    print("Running in simulation mode only.", file=sys.stderr)

logger = logging.getLogger(__name__)

class ThrottleController:
    """Controls the vehicle's ESC (motor) for throttle control"""
    
    # GPIO pins (BCM numbering) - ESC only
    ESC_GPIO = 18      # ESC signal (physical pin 12)
    
    # ESC pulse width ranges (microseconds)
    MIN_US = 1000      # Full reverse
    NEUTRAL = 1500     # Stop
    MAX_US = 2000      # Full forward
    DB_LOW = 1485      # Deadband below neutral
    DB_HIGH = 1515     # Deadband above neutral
    
    # PWM frequencies
    ESC_FREQ_HZ = 50     # ESC expects ~50 Hz
    
    def __init__(self, simulate: bool = False):
        self.pi = None
        self.simulate = bool(simulate)
        self.current_throttle = 0.0      # -1.0 to 1.0
        self.throttle_lock = False       # Must be True (held down) to move
        self.emergency_brake = False     # Must be False (released) to move
        self.power_lock_enabled = True   # Power limit toggle (default: ON)
        self.power_lock_percent = 25.0   # Max power percentage (default: 25%)
        self.last_control_time = 0
        
        if HARDWARE_AVAILABLE and not self.simulate:
            self.initialize_hardware()
    
    def initialize_hardware(self):
        """Initialize pigpio and ESC hardware"""
        try:
            self.pi = pigpio.pi()
            if not self.pi.connected:
                logger.error("Can't connect to pigpiod. Start it: sudo systemctl start pigpiod")
                HARDWARE_AVAILABLE = False
                return
            
            # Set GPIO modes
            self.pi.set_mode(self.ESC_GPIO, pigpio.OUTPUT)
            
            # Set PWM frequencies
            self.pi.set_PWM_frequency(self.ESC_GPIO, self.ESC_FREQ_HZ)
            
            # Initialize to neutral
            self.pi.set_servo_pulsewidth(self.ESC_GPIO, self.NEUTRAL)
            
            logger.info("ESC hardware initialized successfully")
            logger.info(f"ESC GPIO: {self.ESC_GPIO}")
            
        except Exception as e:
            logger.error(f"ESC hardware initialization failed: {e}")
            HARDWARE_AVAILABLE = False
    
    def map_throttle_to_pulse(self, throttle_value: float) -> int:
        """Map throttle value (-1.0 to 1.0) to ESC pulse width"""
        # Safety check: BOTH conditions must be met for vehicle to move
        # 1. Emergency brake must be RELEASED (False)
        # 2. Throttle lock must be HELD DOWN (True)
        if self.emergency_brake or not self.throttle_lock:
            if self.emergency_brake:
                logger.debug("Throttle blocked: Emergency brake is active")
            if not self.throttle_lock:
                logger.debug("Throttle blocked: Throttle lock not held down")
            return self.NEUTRAL
        
        # Apply power lock percentage only if enabled
        if self.power_lock_enabled:
            max_power = self.power_lock_percent / 100.0
            throttle_value *= max_power
            logger.debug(f"Power limit applied: {self.power_lock_percent:.1f}% -> {throttle_value:.3f}")
        
        if abs(throttle_value) < 0.05:  # Deadzone
            return self.NEUTRAL
        
        if throttle_value < 0:  # Forward (was > 0, now < 0)
            lo = self.DB_HIGH + 5
            hi = self.MAX_US
            pct = min(1.0, abs(throttle_value))  # Use abs() since value is negative
            return int(lo + (hi - lo) * pct)
        else:  # Reverse (was < 0, now > 0)
            hi = self.DB_LOW - 5
            lo = self.MIN_US
            pct = min(1.0, throttle_value)  # Value is positive now
            return int(hi - (hi - lo) * pct)
    
    def update_throttle(self, throttle_value: float):
        """Update throttle value"""
        self.current_throttle = float(throttle_value)
        logger.info(f"Throttle: {self.current_throttle:.3f}")
    
    def update_throttle_lock(self, locked: bool):
        """Update throttle lock state (deadman switch)"""
        self.throttle_lock = bool(locked)
        if self.throttle_lock:
            logger.info("Throttle Lock: HELD DOWN - vehicle can move (if emergency brake is released)")
        else:
            logger.info("Throttle Lock: RELEASED - vehicle cannot move (deadman switch)")
            # Immediately stop if throttle lock is released
            if not self.emergency_brake:  # Only stop if not already stopped by emergency brake
                self.stop_vehicle()
    
    def update_emergency_brake(self, active: bool):
        """Update emergency brake state"""
        self.emergency_brake = bool(active)
        if self.emergency_brake:
            logger.warning("EMERGENCY BRAKE ACTIVATED - STOPPING VEHICLE IMMEDIATELY")
            self.stop_vehicle()
        else:
            logger.info("Emergency brake released - vehicle can move if throttle lock is held")
    
    def update_power_lock(self, enabled: bool, power_percent: float = 100.0):
        """Update power lock settings"""
        self.power_lock_enabled = bool(enabled)
        self.power_lock_percent = float(power_percent)
        
        if enabled:
            logger.info(f"Power Lock: {self.power_lock_percent:.1f}% (ENABLED)")
        else:
            logger.info("Power Lock: DISABLED (100% power available)")
    
    def apply_throttle(self):
        """Apply current throttle value to hardware"""
        if not HARDWARE_AVAILABLE or self.simulate:
            # Simulation mode
            throttle_pulse = self.map_throttle_to_pulse(self.current_throttle)
            logger.debug(f"Simulation - Throttle: {throttle_pulse}us")
            return
        
        try:
            # Apply throttle
            throttle_pulse = self.map_throttle_to_pulse(self.current_throttle)
            self.pi.set_servo_pulsewidth(self.ESC_GPIO, throttle_pulse)
            
            # Log significant changes
            if abs(self.current_throttle) > 0.1:
                logger.info(f"Applied - Throttle: {throttle_pulse}us")
                
        except Exception as e:
            logger.error(f"ESC control error: {e}")
    
    def stop_vehicle(self):
        """Emergency stop - set throttle to neutral"""
        self.current_throttle = 0.0
        
        if HARDWARE_AVAILABLE and self.pi:
            try:
                self.pi.set_servo_pulsewidth(self.ESC_GPIO, self.NEUTRAL)
                logger.info("Vehicle stopped - ESC set to neutral")
            except Exception as e:
                logger.error(f"Error stopping vehicle: {e}")
    
    def cleanup(self):
        """Clean up hardware resources"""
        if HARDWARE_AVAILABLE and self.pi:
            try:
                self.stop_vehicle()
                self.pi.stop()
                logger.info("ESC hardware resources cleaned up")
            except Exception as e:
                logger.error(f"Error during ESC cleanup: {e}")
    
    def get_status(self):
        """Get current throttle status"""
        can_move = not self.emergency_brake and self.throttle_lock
        return {
            'throttle': self.current_throttle,
            'throttle_lock': self.throttle_lock,
            'emergency_brake': self.emergency_brake,
            'power_lock_enabled': self.power_lock_enabled,
            'power_lock_percent': self.power_lock_percent,
            'hardware_available': HARDWARE_AVAILABLE,
            'can_move': can_move,
            'safety_status': {
                'emergency_brake_active': self.emergency_brake,
                'throttle_lock_held': self.throttle_lock,
                'vehicle_allowed_to_move': can_move
            }
        }

