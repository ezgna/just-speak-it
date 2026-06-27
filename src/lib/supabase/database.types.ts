export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      diary_entries: {
        Row: {
          bullet_points: Json
          content_hash: string
          created_at: string
          id: string
          original_text: string
          plain_text: string
          source: string
          transcript_words: Json
          updated_at: string
          user_id: string
          waveform_peaks: Json
        }
        Insert: {
          bullet_points: Json
          content_hash: string
          created_at?: string
          id?: string
          original_text: string
          plain_text: string
          source: string
          transcript_words?: Json
          updated_at?: string
          user_id: string
          waveform_peaks?: Json
        }
        Update: {
          bullet_points?: Json
          content_hash?: string
          created_at?: string
          id?: string
          original_text?: string
          plain_text?: string
          source?: string
          transcript_words?: Json
          updated_at?: string
          user_id?: string
          waveform_peaks?: Json
        }
        Relationships: []
      }
      practice_generations: {
        Row: {
          card_split_policy: string
          client_request_id: string
          completed_at: string | null
          created_at: string
          diary_entry_id: string
          draft_model: string
          draft_prompt_version: string
          draft_schema_version: string
          error_message: string | null
          id: string
          started_translating_at: string | null
          status: string
          translation_model: string | null
          translation_prompt_version: string | null
          translation_schema_version: string | null
          translation_style: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_split_policy: string
          client_request_id: string
          completed_at?: string | null
          created_at?: string
          diary_entry_id: string
          draft_model: string
          draft_prompt_version: string
          draft_schema_version: string
          error_message?: string | null
          id?: string
          started_translating_at?: string | null
          status?: string
          translation_model?: string | null
          translation_prompt_version?: string | null
          translation_schema_version?: string | null
          translation_style?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_split_policy?: string
          client_request_id?: string
          completed_at?: string | null
          created_at?: string
          diary_entry_id?: string
          draft_model?: string
          draft_prompt_version?: string
          draft_schema_version?: string
          error_message?: string | null
          id?: string
          started_translating_at?: string | null
          status?: string
          translation_model?: string | null
          translation_prompt_version?: string | null
          translation_schema_version?: string | null
          translation_style?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_generations_diary_owner_fkey"
            columns: ["user_id", "diary_entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      translation_cards: {
        Row: {
          audio_end_sec: number | null
          audio_start_sec: number | null
          created_at: string
          english: string | null
          id: string
          japanese: string
          last_reviewed_at: string | null
          learning_status: string
          next_review_at: string | null
          practice_generation_id: string
          review_count: number
          sort_order: number
          source_word_end_index: number | null
          source_word_start_index: number | null
          success_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_end_sec?: number | null
          audio_start_sec?: number | null
          created_at?: string
          english?: string | null
          id?: string
          japanese: string
          last_reviewed_at?: string | null
          learning_status?: string
          next_review_at?: string | null
          practice_generation_id: string
          review_count?: number
          sort_order: number
          source_word_end_index?: number | null
          source_word_start_index?: number | null
          success_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_end_sec?: number | null
          audio_start_sec?: number | null
          created_at?: string
          english?: string | null
          id?: string
          japanese?: string
          last_reviewed_at?: string | null
          learning_status?: string
          next_review_at?: string | null
          practice_generation_id?: string
          review_count?: number
          sort_order?: number
          source_word_end_index?: number | null
          source_word_start_index?: number | null
          success_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_cards_generation_owner_fkey"
            columns: ["user_id", "practice_generation_id"]
            isOneToOne: false
            referencedRelation: "practice_generations"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_practice_generation: {
        Args: {
          p_generation_id: string
          p_translation_model: string
          p_translation_prompt_version: string
          p_translation_schema_version: string
          p_translation_style: string
        }
        Returns: boolean
      }
      complete_practice_generation: {
        Args: { p_generation_id: string; p_translations: Json }
        Returns: undefined
      }
      discard_practice_generation: {
        Args: { p_generation_id: string }
        Returns: undefined
      }
      fail_practice_generation: {
        Args: { p_error_message: string; p_generation_id: string }
        Returns: undefined
      }
      restore_translation_card_learning_progress: {
        Args: {
          p_card_id: string
          p_last_reviewed_at: string
          p_learning_status: string
          p_next_review_at: string
          p_review_count: number
          p_success_count: number
        }
        Returns: undefined
      }
      save_practice_draft: {
        Args: {
          p_bullet_points: Json
          p_card_split_policy: string
          p_cards: Json
          p_client_request_id: string
          p_content_hash: string
          p_draft_model: string
          p_draft_prompt_version: string
          p_draft_schema_version: string
          p_original_text: string
          p_plain_text: string
          p_source: string
          p_transcript_words: Json
          p_waveform_peaks: Json
        }
        Returns: string
      }
      set_translation_card_learning_status: {
        Args: { p_card_id: string; p_learning_status: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
