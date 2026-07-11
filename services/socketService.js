// services/socketService.js
// Helper utilities for emitting events to Socket.io rooms

/**
 * Emit an event with payload to a specific interview room.
 * @param {import('socket.io').Server} io - The Socket.io server instance.
 * @param {string} roomId - The interview room identifier (usually interview ID).
 * @param {string} event - Event name to emit.
 * @param {*} payload - Data to send with the event.
 */
function emitToRoom(io, roomId, event, payload) {
  if (!io || !roomId || !event) {
    console.warn('emitToRoom called with missing parameters');
    return;
  }
  io.to(roomId).emit(event, payload);
}

module.exports = {
  emitToRoom,
};
