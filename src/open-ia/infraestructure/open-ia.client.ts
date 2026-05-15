import OpenAI from 'openai';

export const OPENAI_CLIENT = 'OPENAI_CLIENT';

export const openaiClient = {
  provide: OPENAI_CLIENT,
  useFactory: () => {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  },
};
