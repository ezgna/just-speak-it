export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          is_anonymous: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          is_anonymous?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          is_anonymous?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      diary_entries: {
        Row: {
          id: string;
          user_id: string;
          source: 'text' | 'voice';
          original_text: string;
          transcript_text: string | null;
          audio_storage_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source?: 'text' | 'voice';
          original_text: string;
          transcript_text?: string | null;
          audio_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source?: 'text' | 'voice';
          original_text?: string;
          transcript_text?: string | null;
          audio_storage_path?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      practice_items: {
        Row: {
          id: string;
          user_id: string;
          diary_entry_id: string;
          japanese: string;
          intent: string;
          natural_english: string;
          simple_english: string;
          pattern_label: string;
          pattern: string;
          short_phrase: string;
          stuck_points: string[];
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          diary_entry_id: string;
          japanese: string;
          intent: string;
          natural_english: string;
          simple_english: string;
          pattern_label: string;
          pattern: string;
          short_phrase: string;
          stuck_points?: string[];
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          diary_entry_id?: string;
          japanese?: string;
          intent?: string;
          natural_english?: string;
          simple_english?: string;
          pattern_label?: string;
          pattern?: string;
          short_phrase?: string;
          stuck_points?: string[];
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      practice_answers: {
        Row: {
          id: string;
          user_id: string;
          practice_item_id: string;
          answer_text: string;
          corrected_text: string;
          simple_text: string;
          feedback_summary: string;
          stuck_points: string[];
          score: number;
          retry_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          practice_item_id: string;
          answer_text: string;
          corrected_text: string;
          simple_text: string;
          feedback_summary: string;
          stuck_points?: string[];
          score: number;
          retry_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          practice_item_id?: string;
          answer_text?: string;
          corrected_text?: string;
          simple_text?: string;
          feedback_summary?: string;
          stuck_points?: string[];
          score?: number;
          retry_count?: number;
          created_at?: string;
        };
      };
      review_schedules: {
        Row: {
          id: string;
          user_id: string;
          practice_item_id: string;
          due_at: string;
          interval_days: number;
          ease_factor: number;
          status: 'scheduled' | 'done' | 'paused';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          practice_item_id: string;
          due_at: string;
          interval_days?: number;
          ease_factor?: number;
          status?: 'scheduled' | 'done' | 'paused';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          practice_item_id?: string;
          due_at?: string;
          interval_days?: number;
          ease_factor?: number;
          status?: 'scheduled' | 'done' | 'paused';
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
