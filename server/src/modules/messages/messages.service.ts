// src/modules/messages/messages.service.ts
//
// TODO(messages): implement per docs/BE/backend-design-nestjs.md.
//
// Observability — when the send() flow is built, wrap it in a manual Sentry span
// (docs/observability.md §8) so the persist-before-broadcast ordering is observable:
//
//   async send(userId: string, conversationId: string, dto: SendMessageDto) {
//     return Sentry.startSpan({ name: 'message.send', op: 'chat.send' }, async (span) => {
//       const message = await Sentry.startSpan(
//         { name: 'message.persist', op: 'db.commit' },
//         () => this.persist(userId, conversationId, dto),   // commit FIRST (NF-16)
//       );
//       span?.setAttribute('conversationId', conversationId);
//       Sentry.startSpan({ name: 'message.broadcast', op: 'ws.emit' }, () =>
//         this.events.emit(AppEvent.MESSAGE_CREATED, { message }),  // emit AFTER commit
//       );
//       return message;
//     });
//   }
//
// In the trace waterfall the db.commit span always closes before ws.emit opens
// (NF-01 ≤200ms delivery). Errors are captured at 100% regardless of trace sampling.

export {};
