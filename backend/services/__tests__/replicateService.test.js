import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios to capture the prediction-creation request and simulate a
// Replicate prediction's status polling loop. This is the only place the
// service's exact `image_input` shape is asserted — the route tests mock the
// whole service, so they could not catch a regression here.
vi.mock('axios', () => {
  const post = vi.fn();
  const get = vi.fn();
  return { default: { post, get } };
});

const axios = (await import('axios')).default;
const { generateTryOn } = await import('../replicateService.js');

const CLOUDINARY_GARMENT = 'https://res.cloudinary.com/demo/image/upload/v1/garment.jpg';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REPLICATE_API_TOKEN = 'test-token';
  process.env.REPLICATE_MODEL = 'nano-banana';
});

describe('generateTryOn — Replicate image_input direct-URL (garment) and data-URI (person)', () => {
  it('sends the vetted Cloudinary garment URL as image_input[0] and the person photo as a data URI', async () => {
    // Prediction created (POST) returns an id; the following status GETs
    // first report "processing" then "succeeded" with an output image URL.
    axios.post.mockResolvedValueOnce({ data: { id: 'pred_1' } });
    axios.get
      .mockResolvedValueOnce({ data: { status: 'processing' } })
      .mockResolvedValueOnce({
        data: { status: 'succeeded', output: ['https://replicate.delivery/out.png'] },
      });
    // The output image is downloaded after success.
    axios.get.mockResolvedValueOnce({ data: Buffer.from('img'), headers: { 'content-type': 'image/png' } });

    const result = await generateTryOn('personBase64', CLOUDINARY_GARMENT, 'Jersey');

    expect(result.success).toBe(true);
    expect(axios.post).toHaveBeenCalledTimes(1);

    const [url, body] = axios.post.mock.calls[0];
    expect(url).toBe('https://api.replicate.com/v1/models/google/nano-banana/predictions');
    const imageInput = body.input.image_input;
    // Garment is the vetted public Cloudinary URL, passed through untouched.
    expect(imageInput[0]).toBe(CLOUDINARY_GARMENT);
    // Person photo stays a data URI — never exposed through a public URL.
    expect(imageInput[1]).toMatch(/^data:image\/jpeg;base64,personBase64$/);
  });

  it('renders the person data URI even if it lacks an explicit data: prefix', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'pred_2' } });
    axios.get
      .mockResolvedValueOnce({ data: { status: 'processing' } })
      .mockResolvedValueOnce({
        data: { status: 'succeeded', output: ['https://replicate.delivery/out2.png'] },
      });
    axios.get.mockResolvedValueOnce({ data: Buffer.from('img'), headers: { 'content-type': 'image/png' } });

    await generateTryOn('rawNoPrefix', CLOUDINARY_GARMENT, 'Jersey');

    const [, body] = axios.post.mock.calls[0];
    expect(body.input.image_input[1]).toMatch(/^data:image\/jpeg;base64,rawNoPrefix$/);
  });
});
