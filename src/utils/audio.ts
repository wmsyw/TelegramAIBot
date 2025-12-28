import { spawn } from 'child_process';
import axios from 'axios';

export async function convertOggToPcm(oggBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',
      '-f', 's16le',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      'pipe:1'
    ]);

    const chunks: Buffer[] = [];
    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on('data', () => {}); // ignore stderr
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg ogg->pcm failed with code ${code}`));
    });
    ffmpeg.on('error', reject);

    ffmpeg.stdin.write(oggBuffer);
    ffmpeg.stdin.end();
  });
}

export async function convertPcmToOgg(pcmBuffer: Buffer, sampleRate = 24000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-f', 's16le',
      '-ar', String(sampleRate),
      '-ac', '1',
      '-i', 'pipe:0',
      '-c:a', 'libopus',
      '-b:a', '24k',
      '-f', 'ogg',
      'pipe:1'
    ]);

    const chunks: Buffer[] = [];
    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on('data', () => {});
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`ffmpeg pcm->ogg failed with code ${code}`));
    });
    ffmpeg.on('error', reject);

    ffmpeg.stdin.write(pcmBuffer);
    ffmpeg.stdin.end();
  });
}

export async function downloadTelegramFile(token: string, filePath: string): Promise<Buffer> {
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}
