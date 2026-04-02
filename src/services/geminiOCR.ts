import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface RosterPlayer {
  firstName: string;
  lastName: string;
  position: string;
  year: string;
  overall: number;
  devTrait: string;
}

/**
 * Converts a browser File object to a base64 string.
 */
const fileToDataPart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Extracts roster data from an image using Gemini.
 */
export const extractRosterFromImage = async (file: File): Promise<RosterPlayer[]> => {
  try {
    const imagePart = await fileToDataPart(file);
    
    const prompt = `
      Extract the roster data from this EA Sports College Football 26 roster screen.
      Return strictly a JSON array of objects with the following keys:
      - firstName
      - lastName
      - position
      - year (e.g., Freshman, Sophomore, Junior, Senior)
      - overall (number)
      - devTrait (e.g., Normal, Impact, Star, Elite)
      
      Do not include any markdown formatting or explanations. Just the raw JSON array.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [imagePart, { text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              firstName: { type: Type.STRING },
              lastName: { type: Type.STRING },
              position: { type: Type.STRING },
              year: { type: Type.STRING },
              overall: { type: Type.NUMBER },
              devTrait: { type: Type.STRING },
            },
            required: ["firstName", "lastName", "position", "year", "overall", "devTrait"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini");
    }

    return JSON.parse(text);
  } catch (error) {
    console.error("Error extracting roster data:", error);
    throw error;
  }
};
