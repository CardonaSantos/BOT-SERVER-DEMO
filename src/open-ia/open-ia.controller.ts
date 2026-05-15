import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CreateOpenIaDto } from './dto/create-open-ia.dto';
import { UpdateOpenIaDto } from './dto/update-open-ia.dto';
import { OpenAiIaService } from './app/open-ia-rag.service';

@Controller('open-ia')
export class OpenIaController {
  constructor(private readonly openIaService: OpenAiIaService) {}
}
