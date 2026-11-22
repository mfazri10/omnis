import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";
import { httpExceptionMessage } from "./http-exception-message";

describe("httpExceptionMessage", () => {
  it("mengambil pesan dari objek respons (bukan 'Bad Request Exception')", () => {
    const error = new BadRequestException({
      message: "Passing grade harus bilangan bulat >= 0 untuk tiap kategori.",
      error: "Bad Request",
      statusCode: 400,
    });
    expect(httpExceptionMessage(error)).toBe(
      "Passing grade harus bilangan bulat >= 0 untuk tiap kategori.",
    );
  });

  it("menggabungkan pesan validasi array ala ValidationPipe", () => {
    const error = new BadRequestException({
      message: ["twk must not be less than 0", "tkp must be an integer number"],
      error: "Bad Request",
      statusCode: 400,
    });
    expect(httpExceptionMessage(error)).toBe(
      "twk must not be less than 0; tkp must be an integer number",
    );
  });

  it("memakai exception.message untuk exception dengan pesan string", () => {
    expect(httpExceptionMessage(new NotFoundException("Soal tidak ditemukan."))).toBe(
      "Soal tidak ditemukan.",
    );
  });

  it("memakai pesan Indonesia pada ForbiddenException berobjek", () => {
    const error = new ForbiddenException({
      message: "Anda tidak memiliki akses untuk tindakan ini.",
      requiredPermission: "platform.roles.manage",
    });
    expect(httpExceptionMessage(error)).toBe(
      "Anda tidak memiliki akses untuk tindakan ini.",
    );
  });

  it("jatuh ke exception.message bila respons tak punya pesan berguna", () => {
    const error = new HttpException({}, 400);
    expect(httpExceptionMessage(error)).toBe("Http Exception");
  });

  it("mengabaikan entri non-string dan string kosong di array", () => {
    const error = new BadRequestException({
      message: ["", 42, "judul tidak boleh kosong"],
    });
    expect(httpExceptionMessage(error)).toBe("judul tidak boleh kosong");
  });
});
