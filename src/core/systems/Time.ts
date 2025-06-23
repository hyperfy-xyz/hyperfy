import { System } from './System';
import type { World } from '../World';

export enum TimeOfDay {
  DAWN = 'dawn',
  MORNING = 'morning',
  NOON = 'noon',
  AFTERNOON = 'afternoon',
  DUSK = 'dusk',
  NIGHT = 'night',
  MIDNIGHT = 'midnight'
}

export interface TimeEvent {
  id: string;
  hour: number;
  minute: number;
  callback: (time: GameTime) => void;
  repeat: boolean;
  lastTriggered?: number;
}

export interface GameTime {
  hour: number;
  minute: number;
  second: number;
  day: number;
  timeOfDay: TimeOfDay;
  isDaytime: boolean;
  sunAngle: number;
  moonPhase: number;
}

interface TimeConfig {
  startHour?: number;
  startMinute?: number;
  startDay?: number;
  timeScale?: number; // How fast time passes (1 = real time, 60 = 1 minute per second)
  pauseTime?: boolean;
}

export class Time extends System {
  name = 'time';
  
  private currentTime: number; // Current time in minutes since day 0
  private timeScale: number;
  private isPaused: boolean;
  private events: Map<string, TimeEvent>;
  private timeListeners: Set<(time: GameTime) => void>;
  
  // Time constants
  private readonly MINUTES_PER_HOUR = 60;
  private readonly HOURS_PER_DAY = 24;
  private readonly MINUTES_PER_DAY = this.MINUTES_PER_HOUR * this.HOURS_PER_DAY;
  
  // Time of day boundaries (in hours)
  private readonly TIME_BOUNDARIES = {
    DAWN_START: 5,
    MORNING_START: 7,
    NOON_START: 11,
    AFTERNOON_START: 13,
    DUSK_START: 17,
    NIGHT_START: 19,
    MIDNIGHT_START: 23
  };
  
  constructor(world: World, config: TimeConfig = {}) {
    super(world);
    
    const startHour = config.startHour ?? 12;
    const startMinute = config.startMinute ?? 0;
    const startDay = config.startDay ?? 1;
    
    this.currentTime = (startDay - 1) * this.MINUTES_PER_DAY + 
                       startHour * this.MINUTES_PER_HOUR + 
                       startMinute;
    
    this.timeScale = config.timeScale ?? 60; // Default: 1 game hour per real minute
    this.isPaused = config.pauseTime ?? false;
    this.events = new Map();
    this.timeListeners = new Set();
  }
  
  async init(): Promise<void> {
    const time = this.getTime();
    console.log(`Time system initialized - Day ${time.day}, ${time.hour}:${time.minute.toString().padStart(2, '0')}`);
  }
  
  update(dt: number): void {
    if (this.isPaused) return;
    
    // Convert delta time from milliseconds to minutes
    const deltaMinutes = (dt / 1000 / 60) * this.timeScale;
    const previousTime = this.currentTime;
    this.currentTime += deltaMinutes;
    
    // Check for day transition
    const previousDay = Math.floor(previousTime / this.MINUTES_PER_DAY);
    const currentDay = Math.floor(this.currentTime / this.MINUTES_PER_DAY);
    
    if (currentDay > previousDay) {
      this.onDayChange(currentDay);
    }
    
    // Check time events
    this.checkTimeEvents();
    
    // Notify listeners
    const gameTime = this.getTime();
    for (const listener of this.timeListeners) {
      listener(gameTime);
    }
  }
  
  // Get current game time
  getTime(): GameTime {
    const totalMinutes = this.currentTime % this.MINUTES_PER_DAY;
    const hour = Math.floor(totalMinutes / this.MINUTES_PER_HOUR);
    const minute = Math.floor(totalMinutes % this.MINUTES_PER_HOUR);
    const second = Math.floor((totalMinutes * 60) % 60);
    const day = Math.floor(this.currentTime / this.MINUTES_PER_DAY) + 1;
    
    const timeOfDay = this.getTimeOfDay(hour);
    const isDaytime = hour >= 6 && hour < 18;
    const sunAngle = this.calculateSunAngle(hour, minute);
    const moonPhase = this.calculateMoonPhase(day);
    
    return {
      hour,
      minute,
      second,
      day,
      timeOfDay,
      isDaytime,
      sunAngle,
      moonPhase
    };
  }
  
  // Set current time
  setTime(hour: number, minute: number = 0, day?: number): void {
    const currentDay = day ?? this.getTime().day;
    this.currentTime = (currentDay - 1) * this.MINUTES_PER_DAY + 
                       hour * this.MINUTES_PER_HOUR + 
                       minute;
  }
  
  // Add time
  addTime(hours: number = 0, minutes: number = 0, days: number = 0): void {
    this.currentTime += days * this.MINUTES_PER_DAY + 
                        hours * this.MINUTES_PER_HOUR + 
                        minutes;
  }
  
  // Time control
  pause(): void {
    this.isPaused = true;
  }
  
  resume(): void {
    this.isPaused = false;
  }
  
  setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, scale);
  }
  
  // Event management
  addEvent(event: TimeEvent): void {
    this.events.set(event.id, event);
  }
  
  removeEvent(id: string): void {
    this.events.delete(id);
  }
  
  // Add listener for time changes
  addTimeListener(callback: (time: GameTime) => void): void {
    this.timeListeners.add(callback);
  }
  
  removeTimeListener(callback: (time: GameTime) => void): void {
    this.timeListeners.delete(callback);
  }
  
  // Get time of day based on hour
  private getTimeOfDay(hour: number): TimeOfDay {
    const { TIME_BOUNDARIES } = this;
    
    if (hour >= TIME_BOUNDARIES.DAWN_START && hour < TIME_BOUNDARIES.MORNING_START) {
      return TimeOfDay.DAWN;
    } else if (hour >= TIME_BOUNDARIES.MORNING_START && hour < TIME_BOUNDARIES.NOON_START) {
      return TimeOfDay.MORNING;
    } else if (hour >= TIME_BOUNDARIES.NOON_START && hour < TIME_BOUNDARIES.AFTERNOON_START) {
      return TimeOfDay.NOON;
    } else if (hour >= TIME_BOUNDARIES.AFTERNOON_START && hour < TIME_BOUNDARIES.DUSK_START) {
      return TimeOfDay.AFTERNOON;
    } else if (hour >= TIME_BOUNDARIES.DUSK_START && hour < TIME_BOUNDARIES.NIGHT_START) {
      return TimeOfDay.DUSK;
    } else if (hour >= TIME_BOUNDARIES.NIGHT_START && hour < TIME_BOUNDARIES.MIDNIGHT_START) {
      return TimeOfDay.NIGHT;
    } else {
      return TimeOfDay.MIDNIGHT;
    }
  }
  
  // Calculate sun angle (0-360 degrees)
  private calculateSunAngle(hour: number, minute: number): number {
    const totalMinutes = hour * 60 + minute;
    const dayProgress = totalMinutes / this.MINUTES_PER_DAY;
    return dayProgress * 360;
  }
  
  // Calculate moon phase (0-1, where 0 = new moon, 0.5 = full moon, 1 = new moon)
  private calculateMoonPhase(day: number): number {
    const lunarCycle = 29.5; // Days in lunar cycle
    const phase = (day % lunarCycle) / lunarCycle;
    return phase;
  }
  
  // Check and trigger time events
  private checkTimeEvents(): void {
    const currentTime = this.getTime();
    const currentMinutes = currentTime.hour * 60 + currentTime.minute;
    
    for (const event of this.events.values()) {
      const eventMinutes = event.hour * 60 + event.minute;
      const lastTriggeredDay = event.lastTriggered ? 
        Math.floor(event.lastTriggered / this.MINUTES_PER_DAY) : -1;
      const currentDay = currentTime.day - 1;
      
      // Check if event should trigger
      if (currentMinutes >= eventMinutes && 
          currentMinutes < eventMinutes + 1 && // Within the minute
          (event.repeat || lastTriggeredDay < currentDay)) {
        
        event.callback(currentTime);
        event.lastTriggered = this.currentTime;
        
        if (!event.repeat) {
          this.events.delete(event.id);
        }
      }
    }
  }
  
  // Called when day changes
  private onDayChange(newDay: number): void {
    console.log(`Day ${newDay} has begun`);
    
    // Reset any daily events or states
    // This could trigger world events, reset spawns, etc.
    if (this.world.network && this.world.network.isServer) {
      this.world.network.send('dayChange', {
        day: newDay
      });
    }
  }
  
  // Format time for display
  formatTime(time?: GameTime): string {
    const t = time ?? this.getTime();
    const hourStr = t.hour.toString().padStart(2, '0');
    const minuteStr = t.minute.toString().padStart(2, '0');
    const secondStr = t.second.toString().padStart(2, '0');
    return `Day ${t.day} - ${hourStr}:${minuteStr}:${secondStr}`;
  }
  
  // Get time until next occurrence of specific hour
  getTimeUntil(targetHour: number, targetMinute: number = 0): number {
    const currentTime = this.getTime();
    const currentMinutes = currentTime.hour * 60 + currentTime.minute;
    const targetMinutes = targetHour * 60 + targetMinute;
    
    let minutesUntil = targetMinutes - currentMinutes;
    if (minutesUntil <= 0) {
      minutesUntil += this.MINUTES_PER_DAY;
    }
    
    return minutesUntil;
  }
  
  // Debug info
  getDebugInfo(): { 
    currentTime: string; 
    timeScale: number; 
    isPaused: boolean;
    eventCount: number;
    listenerCount: number;
  } {
    return {
      currentTime: this.formatTime(),
      timeScale: this.timeScale,
      isPaused: this.isPaused,
      eventCount: this.events.size,
      listenerCount: this.timeListeners.size
    };
  }
} 