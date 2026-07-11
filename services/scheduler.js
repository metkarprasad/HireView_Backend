const Interview = require('../models/Interview');
const emailService = require('./emailService');

let intervalId = null;

const runSchedulerCheck = async () => {
  try {
    const now = new Date();
    // Look for interviews scheduled between 9 and 11 minutes in the future
    const windowStart = new Date(now.getTime() + 9 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 11 * 60 * 1000);

    // Find interviews scheduled in that time window which haven't sent a reminder
    const upcomingInterviews = await Interview.find({
      status: 'scheduled',
      isScheduled: true,
      scheduledAt: { $gte: windowStart, $lte: windowEnd },
      reminderSent: { $ne: true },
    }).populate('userId');

    if (upcomingInterviews.length > 0) {
      console.log(`[SCHEDULER] Found ${upcomingInterviews.length} upcoming scheduled interview(s) to notify.`);
      
      for (const interview of upcomingInterviews) {
        const user = interview.userId;
        if (!user || !user.email) {
          console.warn(`[SCHEDULER] Could not notify for interview ${interview._id} because user details are missing.`);
          continue;
        }

        // Send email notification
        await emailService.sendInterviewReminder(
          user.email,
          user.username,
          interview.technology,
          interview.difficulty,
          interview.scheduledAt,
          interview.duration
        );

        // Update database to mark notification as sent
        interview.reminderSent = true;
        await interview.save();
        console.log(`[SCHEDULER] Marked interview ${interview._id} reminderSent as true.`);
      }
    }
  } catch (err) {
    console.error('[SCHEDULER ERROR] Error in reminder scheduler loop:', err.message);
  }
};

const startReminderScheduler = () => {
  if (intervalId) {
    console.warn('[SCHEDULER] Scheduler is already running.');
    return;
  }

  console.log('[SCHEDULER] Initializing AI Interview reminder scheduler (scanning every 60s)...');
  
  // Run once immediately on start
  runSchedulerCheck();

  // Run every 60 seconds
  intervalId = setInterval(runSchedulerCheck, 60 * 1000);
};

const stopReminderScheduler = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[SCHEDULER] Stopped AI Interview reminder scheduler.');
  }
};

module.exports = {
  startReminderScheduler,
  stopReminderScheduler,
};
