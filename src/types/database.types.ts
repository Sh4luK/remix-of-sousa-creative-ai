export interface Brand {
  user_id: string;
  name: string;
  slogan: string;
  colors: string[];
  default_phrase: string;
  button_text: string;
  signature: string;
  logo_path?: string | null;
  updated_at?: string;
}

export interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  productName: string;
  category: string;
  style: string;
  format: string;
  createdAt: string;
  favorite: boolean;
}

export type ProductPick =
  | { kind: "catalog"; id: string; name: string; category: string; emoji: string }
  | { kind: "upload"; name: string; previewUrl: string; base64: string }
  | { kind: "custom"; name: string };
