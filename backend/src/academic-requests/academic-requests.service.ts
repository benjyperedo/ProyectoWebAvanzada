
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

// ==========================================
// TIPOS DE SOLICITUDES
// ==========================================

export type AcademicRequestType =
  | 'ABSENCE_JUSTIFICATION'
  | 'OVERCAPACITY'
  | 'ENROLLMENT_PROBLEM'
  | 'OTHER';

// ==========================================
// DATOS DEL FORMULARIO
// ==========================================

export interface CreateAcademicRequestDto {
  type: AcademicRequestType;
  recipientEmail: string;
  courseName?: string;
  absenceDate?: string;
  subject?: string;
  description: string;
}

// ==========================================
// ARCHIVO ADJUNTO
// ==========================================

export interface AcademicRequestFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class AcademicRequestsService {

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // ==========================================
  // VALIDAR TEXTO
  // ==========================================

  private validarTexto(
    valor: unknown,
    campo: string,
    maximo: number,
    obligatorio = true,
  ): string | null {

    if (typeof valor !== 'string') {
      if (obligatorio) {
        throw new BadRequestException(
          `El campo ${campo} es obligatorio.`,
        );
      }

      return null;
    }

    const texto = valor.trim();

    if (!texto) {
      if (obligatorio) {
        throw new BadRequestException(
          `El campo ${campo} es obligatorio.`,
        );
      }

      return null;
    }

    if (texto.length > maximo) {
      throw new BadRequestException(
        `El campo ${campo} supera los ${maximo} caracteres.`,
      );
    }

    return texto;
  }

  // ==========================================
  // VALIDAR CORREO
  // ==========================================

  private validarCorreo(valor: unknown): string {

    const correo = this.validarTexto(
      valor,
      'correo del destinatario',
      255,
    )!;

    const expresion = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!expresion.test(correo)) {
      throw new BadRequestException(
        'Ingresa un correo electrónico válido.',
      );
    }

    return correo;
  }

  // ==========================================
  // VALIDAR FECHA DE INASISTENCIA
  // ==========================================

  private validarFecha(valor: unknown): Date {

    const fechaTexto = this.validarTexto(
      valor,
      'fecha de inasistencia',
      10,
    )!;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)) {
      throw new BadRequestException(
        'La fecha debe tener formato YYYY-MM-DD.',
      );
    }

    const fecha = new Date(
      `${fechaTexto}T00:00:00.000Z`,
    );

    if (
      Number.isNaN(fecha.getTime()) ||
      fecha.toISOString().slice(0, 10) !== fechaTexto
    ) {
      throw new BadRequestException(
        'La fecha de inasistencia no es válida.',
      );
    }

    return fecha;
  }

  // ==========================================
  // VALIDAR ARCHIVO ADJUNTO
  // ==========================================

  private validarArchivo(archivo: AcademicRequestFile): {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    content: Uint8Array<ArrayBuffer>;
  } {

    const maximoBytes = 5 * 1024 * 1024;

    if (
      !Buffer.isBuffer(archivo.buffer) ||
      archivo.size === 0 ||
      archivo.size > maximoBytes ||
      archivo.buffer.length !== archivo.size
    ) {
      throw new BadRequestException(
        'El archivo es inválido o supera los 5 MB.',
      );
    }

    const nombre = archivo.originalname
      .replace(/[/\\\x00-\x1F\x7F]/g, '_')
      .slice(0, 255);

    const extension = nombre
      .split('.')
      .pop()
      ?.toLowerCase();

    const contenido = archivo.buffer;

    const esPdf =
      contenido.subarray(0, 5).toString('ascii') ===
      '%PDF-';

    const esPng =
      contenido.subarray(0, 8).equals(
        Buffer.from([
          137, 80, 78, 71, 13, 10, 26, 10,
        ]),
      );

    const esJpeg =
      contenido.length >= 3 &&
      contenido[0] === 0xff &&
      contenido[1] === 0xd8 &&
      contenido[2] === 0xff;

    let tipo: string;

    if (esPdf && extension === 'pdf') {
      tipo = 'application/pdf';
    } else if (esPng && extension === 'png') {
      tipo = 'image/png';
    } else if (
      esJpeg &&
      (extension === 'jpg' || extension === 'jpeg')
    ) {
      tipo = 'image/jpeg';
    } else {
      throw new BadRequestException(
        'Solo se permiten archivos PDF, PNG o JPG válidos.',
      );
    }

    const tipoDeclarado = archivo.mimetype;

    if (
      tipoDeclarado !== tipo &&
      tipoDeclarado !== 'application/octet-stream'
    ) {
      throw new BadRequestException(
        'El tipo de archivo no coincide con su contenido.',
      );
    }

    const bufferSeguro = new ArrayBuffer(contenido.length);
    const contenidoPrisma = new Uint8Array(bufferSeguro);
    contenidoPrisma.set(contenido);

    return {
      fileName: nombre,
      mimeType: tipo,
      sizeBytes: archivo.size,
      content: contenidoPrisma,
    };
  }

  // ==========================================
  // CREAR SOLICITUD ACADÉMICA
  // ==========================================

  async crearTramite(
    userId: number,
    datos: CreateAcademicRequestDto,
    archivo?: AcademicRequestFile,
  ) {

    const tiposPermitidos: AcademicRequestType[] = [
      'ABSENCE_JUSTIFICATION',
      'OVERCAPACITY',
      'ENROLLMENT_PROBLEM',
      'OTHER',
    ];

    if (!tiposPermitidos.includes(datos.type)) {
      throw new BadRequestException(
        'El tipo de trámite no es válido.',
      );
    }

    const correo = this.validarCorreo(
      datos.recipientEmail,
    );

    const descripcion = this.validarTexto(
      datos.description,
      'descripción',
      4000,
    )!;

    const requiereAsignatura =
      datos.type !== 'OTHER';

    const asignatura = requiereAsignatura
      ? this.validarTexto(
          datos.courseName,
          'asignatura',
          150,
        )
      : null;

    const asunto =
      datos.type === 'OTHER'
        ? this.validarTexto(
            datos.subject,
            'asunto',
            150,
          )
        : null;

    const fechaInasistencia =
      datos.type === 'ABSENCE_JUSTIFICATION'
        ? this.validarFecha(datos.absenceDate)
        : null;

    if (
      archivo &&
      datos.type !== 'ABSENCE_JUSTIFICATION'
    ) {
      throw new BadRequestException(
        'Los justificativos adjuntos solo están disponibles para inasistencias.',
      );
    }

    const adjunto = archivo
      ? this.validarArchivo(archivo)
      : null;

    // Crear la solicitud y su adjunto
    // en una misma operación de Prisma.

    return this.prisma.academicRequest.create({
      data: {
        userId,
        type: datos.type,
        recipientEmail: correo,
        courseName: asignatura,
        absenceDate: fechaInasistencia,
        subject: asunto,
        description: descripcion,

        attachment: adjunto
          ? {
              create: adjunto,
            }
          : undefined,
      },

      // Solo devolver los metadatos del archivo,
      // no el contenido del justificativo.
      include: {
        attachment: {
          select: {
            fileName: true,
            mimeType: true,
            sizeBytes: true,
          },
        },
      },
    });
  }

  // ==========================================
  // LISTAR MIS TRÁMITES
  // ==========================================

  async listarTramites(userId: number) {

    return this.prisma.academicRequest.findMany({
      where: {
        userId,
      },

      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],

      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        recipientEmail: true,
        courseName: true,
        absenceDate: true,
        subject: true,
        description: true,
        createdAt: true,
        updatedAt: true,

        attachment: {
          select: {
            fileName: true,
            mimeType: true,
            sizeBytes: true,
          },
        },
      },
    });
  }

  // ==========================================
  // CONSULTAR UN TRÁMITE
  // ==========================================

  async obtenerTramite(
    userId: number,
    requestId: number,
  ) {

    const tramite =
      await this.prisma.academicRequest.findFirst({
        where: {
          id: requestId,
          userId,
        },

        include: {
          attachment: {
            select: {
              fileName: true,
              mimeType: true,
              sizeBytes: true,
            },
          },
        },
      });

    if (!tramite) {
      throw new NotFoundException(
        'El trámite no existe o no tienes acceso.',
      );
    }

    return tramite;
  }

  // ==========================================
  // OBTENER JUSTIFICATIVO ADJUNTO
  // ==========================================

  async obtenerAdjunto(
    userId: number,
    requestId: number,
  ) {

    const tramite =
      await this.prisma.academicRequest.findFirst({
        where: {
          id: requestId,
          userId,
        },

        include: {
          attachment: true,
        },
      });

    if (!tramite) {
      throw new NotFoundException(
        'El trámite no existe o no tienes acceso.',
      );
    }

    if (!tramite.attachment) {
      throw new NotFoundException(
        'Este trámite no tiene un archivo adjunto.',
      );
    }

    return tramite.attachment;
  }
}
