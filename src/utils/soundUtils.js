import notificationSoundFile from "../assets/sounds/notification.wav";
import badgeSoundFile from "../assets/sounds/badge.wav";

/**
 * Sound utility for playing notification and badge earned sounds
 * Uses HTML5 Audio API to play audio files from assets
 */

/**
 * Play a notification sound
 */
export function playNotificationSound() {
  try {
    const audio = new Audio(notificationSoundFile);
    audio.volume = 0.5;
    audio.play().catch((error) => {
      console.error("Error playing notification sound:", error);
    });
  } catch (error) {
    console.error("Error creating notification sound:", error);
  }
}

/**
 * Play a badge earned sound
 */
export function playBadgeEarnedSound() {
  try {
    const audio = new Audio(badgeSoundFile);
    audio.volume = 0.5;
    audio.play().catch((error) => {
      console.error("Error playing badge earned sound:", error);
    });
  } catch (error) {
    console.error("Error creating badge sound:", error);
  }
}

/**
 * Play a generic success sound (uses badge sound)
 */
export function playSuccessSound() {
  playBadgeEarnedSound();
}

/**
 * Enable audio context by user interaction (required by browser policy)
 * Call this in a click handler or other user interaction
 */
export function enableAudioOnUserInteraction() {
  // No longer needed with HTML5 Audio API, but kept for backward compatibility
}
