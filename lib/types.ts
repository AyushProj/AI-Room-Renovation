export interface RoomAnalysis {
  roomType: string;
  existingFurniture: string[];
  style: string;
  lighting: string;
  condition: string;
  dominantColors: string[];
  notes: string;
}

export type QuestionType = "single_select" | "multi_select" | "text";

export interface Question {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
}

export type Answer = string | string[];
export type AnswersMap = Record<string, Answer>;

export interface ExtractedItem {
  label: string;
  x: number;
  y: number;
}

export interface MatchedProduct {
  title: string;
  price: string;
  thumbnail: string;
  link: string;
  retailer: string;
}

export interface ItemWithMatches extends ExtractedItem {
  products: MatchedProduct[];
}

