// src/modules/messages/attachments.service.ts
import {
  Injectable,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AttachmentKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AttachmentView } from '../../common/types/conversation-view';

/** The subset of a multipart upload we rely on (avoids a hard @types/multer dependency). */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
}

/** Server-enforced upload limit (messages.openapi.yaml → 413 PayloadTooLarge). */
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MiB

/**
 * AttachmentsService — POST /attachments (FR-17, P3). Two-step upload: store the file and
 * return an Attachment id, which the FE then references in `attachmentIds` on send. Real
 * object storage (S3/R2) is a P3 dependency; until it lands we persist the metadata and
 * return a deterministic stub URL so the send flow can be exercised end-to-end.
 */
@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(uploaderId: string, file: UploadedFile | undefined): Promise<AttachmentView> {
    if (!file) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'A file is required',
      });
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: 'File exceeds the maximum allowed size',
      });
    }

    const kind = file.mimetype.startsWith('image/') ? AttachmentKind.IMAGE : AttachmentKind.FILE;

    const attachment = await this.prisma.attachment.create({
      data: {
        uploaderId,
        // messageId stays null until the attachment is referenced on send (upload-before-send).
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        kind,
        url: '', // filled below once the id exists
      },
    });

    // Stub object-storage URL keyed by the row id (replaced by a signed S3/R2 URL in P3).
    const url = `${this.baseUrl()}/attachments/${attachment.id}`;
    await this.prisma.attachment.update({ where: { id: attachment.id }, data: { url } });

    return {
      id: attachment.id,
      url,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      kind: attachment.kind.toLowerCase() as 'image' | 'file',
    };
  }

  private baseUrl(): string {
    return process.env.ATTACHMENTS_BASE_URL ?? 'https://storage.local';
  }
}
