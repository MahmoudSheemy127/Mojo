// src/common/utils/message-view.ts
// Serializes a persisted Message (+ its attachments) into the contract-shaped MessageView
// (docs/contract/_common.yaml#Message). Shared by ConversationsService (lastMessage preview),
// MessagesService (history + send response), and the realtime layer (message:new broadcast)
// so every surface emits the exact same shape. The numeric `sequence` is derived from the
// ULID id (prisma-schema-design.md note 3) — there is no sequence column.
import { Prisma } from '@prisma/client';
import { AttachmentView, MessageView } from '../types/conversation-view';
import { ulidToSequence } from './ulid';

/** A Message row with its attachments eagerly loaded — the input the serializer needs. */
export type MessageWithAttachments = Prisma.MessageGetPayload<{ include: { attachments: true } }>;

/** Map a Message row to the contract Message shape (oldest→newest callers handle ordering). */
export function toMessageView(message: MessageWithAttachments): MessageView {
  return {
    id: message.id,
    conversationId: message.conversationId,
    sequence: ulidToSequence(message.id),
    senderId: message.senderId,
    // Null when soft-deleted (FR-16); the row stays so the FE renders the placeholder.
    content: message.content,
    attachments: message.attachments.map(
      (a): AttachmentView => ({
        id: a.id,
        url: a.url,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        kind: a.kind.toLowerCase() as 'image' | 'file',
      }),
    ),
    // Persisted baseline status; per-recipient delivered/read tracking is the realtime layer.
    status: 'sent',
    createdAt: message.createdAt.toISOString(),
    deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
  };
}
