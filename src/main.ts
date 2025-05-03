import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const PORT = process.env.PORT || 8001;

  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('FRAUD DETECTION Documentation')
    .setDescription('The PROJECT API description')
    .setVersion('1.0')
    // .addApiKey({ type: 'apiKey', name: 'Authorization', in: 'header' })
    .addBearerAuth({
      name: 'Authorization',
      bearerFormat: 'Bearer',
      scheme: 'Bearer',
      in: 'header',
      type: 'http',
    })

    .build();

  const document = SwaggerModule.createDocument(app, config);
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api/docs', app, document);
  }

  // await app.listen(process.env.PORT ?? 3000);
  await app.listen(PORT, async () => {
    const serverUrl = await app.getUrl();
    Logger.log(`Work With us service started on ${serverUrl} port ${PORT}`);
  });
}
bootstrap();
