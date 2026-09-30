/**
 * Template discovery is prepared here and filled in later.
 * This module intentionally has no template records.
 */

export interface TemplatePreview {
  imageUrl?: string;
  accent?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  categories: string[];
  purposes: string[];
  styles: string[];
  preview: TemplatePreview | null;
  version: number;
}

export interface TemplateRecommendationContext {
  categories: string[];
  purposes: string[];
  title?: string;
}
