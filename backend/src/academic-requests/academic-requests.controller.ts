
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { Auth } from '../auth/auth.decorator.js';

import type {
  AuthenticatedRequest,
} from '../auth/auth.types.js';

import {
  AcademicRequestsService,
  type AcademicRequestFile,
  type CreateAcademicRequestDto,
} from './academic-requests.service.js';

// ==========================================
// CONTROLADOR DE TRÁMITES ACADÉMICOS
// ==========================================

@Controller('academic-requests')
export class AcademicRequestsController {

  constructor(
    private readonly academicRequestsService:
      AcademicRequestsService,
  ) {}

  // ==========================================
  // OBTENER ESTUDIANTE AUTENTICADO
  // ==========================================

  private obtenerUserId(
    request: AuthenticatedRequest,
  ): number {

    const userId = request.user?.sub;

    if (userId === undefined) {
      throw new UnauthorizedException(
        'Debes iniciar sesión para realizar trámites académicos.',
      );
    }

    return userId;
  }

  // ==========================================
  // 1. CONSULTAR MIS TRÁMITES
  // ==========================================

  @Get()
  @Auth()
  listarTramites(
    @Req() request: AuthenticatedRequest,
  ) {

    const userId = this.obtenerUserId(request);

    return this.academicRequestsService
      .listarTramites(userId);
  }

  // ==========================================
  // 2. CREAR TRÁMITE ACADÉMICO
  // ==========================================

  @Post()
  @Auth()
  @UseInterceptors(
    FileInterceptor('attachment', {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
      },
    }),
  )
  crearTramite(
    @Req() request: AuthenticatedRequest,
    @Body() datos: CreateAcademicRequestDto,
    @UploadedFile() archivo?: AcademicRequestFile,
  ) {

    const userId = this.obtenerUserId(request);

    return this.academicRequestsService
      .crearTramite(
        userId,
        datos,
        archivo,
      );
  }

  // ==========================================
  // 3. DESCARGAR JUSTIFICATIVO
  // ==========================================

  @Get(':id/attachment')
  @Auth()
  async descargarAdjunto(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) requestId: number,
  ): Promise<StreamableFile> {

    const userId = this.obtenerUserId(request);

    const adjunto =
      await this.academicRequestsService
        .obtenerAdjunto(
          userId,
          requestId,
        );

    const nombreCodificado =
      encodeURIComponent(adjunto.fileName);

    return new StreamableFile(
      Buffer.from(adjunto.content),
      {
        type: adjunto.mimeType,

        disposition:
          'attachment; filename="justificativo"; ' +
          `filename*=UTF-8''${nombreCodificado}`,

        length: adjunto.sizeBytes,
      },
    );
  }

  // ==========================================
  // 4. CONSULTAR UN TRÁMITE ESPECÍFICO
  // ==========================================

  @Get(':id')
  @Auth()
  obtenerTramite(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseIntPipe) requestId: number,
  ) {

    const userId = this.obtenerUserId(request);

    return this.academicRequestsService
      .obtenerTramite(
        userId,
        requestId,
      );
  }
}
