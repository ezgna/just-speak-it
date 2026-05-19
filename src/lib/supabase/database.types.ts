export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      diary_entries: {
        Row: {
          id: string;
          user_id: string;
          source: 'text' | 'voice';
          raw_transcript_text: string;
          cleaned_text: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source?: 'text' | 'voice';
          raw_transcript_text: string;
          cleaned_text: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source?: 'text' | 'voice';
          raw_transcript_text?: string;
          cleaned_text?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      translation_cards: {
        Row: {
          id: string;
          user_id: string;
          diary_entry_id: string;
          sort_order: number;
          japanese: string;
          english: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          diary_entry_id: string;
          sort_order?: number;
          japanese: string;
          english: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          diary_entry_id?: string;
          sort_order?: number;
          japanese?: string;
          english?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
