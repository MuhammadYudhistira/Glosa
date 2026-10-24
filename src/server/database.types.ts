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
    PostgrestVersion: "14.18"
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
      app_settings: {
        Row: {
          id: boolean
          signups_open: boolean
        }
        Insert: {
          id?: boolean
          signups_open?: boolean
        }
        Update: {
          id?: boolean
          signups_open?: boolean
        }
        Relationships: []
      }
      books: {
        Row: {
          author: string
          cover_path: string | null
          created_at: string
          description: string | null
          file_path: string
          genre: string | null
          genre_source: string | null
          id: string
          language: string | null
          last_opened_at: string | null
          sha256: string
          size_bytes: number
          status: string
          subjects: string[]
          title: string
          user_id: string
          work_id: string | null
        }
        Insert: {
          author?: string
          cover_path?: string | null
          created_at?: string
          description?: string | null
          file_path: string
          genre?: string | null
          genre_source?: string | null
          id?: string
          language?: string | null
          last_opened_at?: string | null
          sha256: string
          size_bytes: number
          status?: string
          subjects?: string[]
          title: string
          user_id: string
          work_id?: string | null
        }
        Update: {
          author?: string
          cover_path?: string | null
          created_at?: string
          description?: string | null
          file_path?: string
          genre?: string | null
          genre_source?: string | null
          id?: string
          language?: string | null
          last_opened_at?: string | null
          sha256?: string
          size_bytes?: number
          status?: string
          subjects?: string[]
          title?: string
          user_id?: string
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dict_entries: {
        Row: {
          headword: string
          meanings: string[]
          pos: string
        }
        Insert: {
          headword: string
          meanings: string[]
          pos: string
        }
        Update: {
          headword?: string
          meanings?: string[]
          pos?: string
        }
        Relationships: []
      }
      dict_entries_staging: {
        Row: {
          headword: string
          meanings: string[]
          pos: string
        }
        Insert: {
          headword: string
          meanings: string[]
          pos: string
        }
        Update: {
          headword?: string
          meanings?: string[]
          pos?: string
        }
        Relationships: []
      }
      dict_forms: {
        Row: {
          form: string
          headword: string
          pos: string
        }
        Insert: {
          form: string
          headword: string
          pos: string
        }
        Update: {
          form?: string
          headword?: string
          pos?: string
        }
        Relationships: [
          {
            foreignKeyName: "dict_forms_headword_pos_fkey"
            columns: ["headword", "pos"]
            isOneToOne: false
            referencedRelation: "dict_entries"
            referencedColumns: ["headword", "pos"]
          },
        ]
      }
      dict_forms_staging: {
        Row: {
          form: string
          headword: string
          pos: string
        }
        Insert: {
          form: string
          headword: string
          pos: string
        }
        Update: {
          form?: string
          headword?: string
          pos?: string
        }
        Relationships: []
      }
      dict_meta: {
        Row: {
          dump_date: string | null
          entries: number
          forms: number
          id: boolean
          imported_at: string
          source: string
        }
        Insert: {
          dump_date?: string | null
          entries: number
          forms: number
          id?: boolean
          imported_at?: string
          source: string
        }
        Update: {
          dump_date?: string | null
          entries?: number
          forms?: number
          id?: boolean
          imported_at?: string
          source?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          member_no: number
          onboarded_at: string | null
          plan: string
          reader_settings: Json
          storage_limit_bytes: number
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          member_no?: number
          onboarded_at?: string | null
          plan?: string
          reader_settings?: Json
          storage_limit_bytes?: number
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          member_no?: number
          onboarded_at?: string | null
          plan?: string
          reader_settings?: Json
          storage_limit_bytes?: number
          username?: string
        }
        Relationships: []
      }
      reading_progress: {
        Row: {
          book_id: string
          cfi: string
          percentage: number
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          cfi: string
          percentage: number
          updated_at: string
          user_id: string
        }
        Update: {
          book_id?: string
          cfi?: string
          percentage?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_progress_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_words: {
        Row: {
          book_id: string | null
          book_title: string | null
          cfi: string | null
          created_at: string
          headword: string
          id: string
          meanings: string[]
          pos: string | null
          sentence: string
          user_id: string
        }
        Insert: {
          book_id?: string | null
          book_title?: string | null
          cfi?: string | null
          created_at?: string
          headword: string
          id?: string
          meanings?: string[]
          pos?: string | null
          sentence?: string
          user_id: string
        }
        Update: {
          book_id?: string | null
          book_title?: string | null
          cfi?: string | null
          created_at?: string
          headword?: string
          id?: string
          meanings?: string[]
          pos?: string | null
          sentence?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_words_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_words_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_invites: {
        Row: {
          created_at: string
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      before_user_created: { Args: { event: Json }; Returns: Json }
      delete_word: { Args: { p_headword: string }; Returns: undefined }
      dict_pos_rank: { Args: { p_pos: string }; Returns: number }
      dict_staging_reset: { Args: never; Returns: undefined }
      dict_swap: {
        Args: { p_dump_date?: string; p_force?: boolean; p_source: string }
        Returns: Json
      }
      lookup_word: {
        Args: { p_next?: string[]; p_word: string }
        Returns: Json
      }
      mark_book_ready: {
        Args: { p_book_id: string; p_user_id: string }
        Returns: boolean
      }
      normalize_username: { Args: { raw: string }; Returns: string }
      reserve_book_upload: {
        Args: {
          p_author: string
          p_book_id: string
          p_cover_bytes?: number
          p_cover_type?: string
          p_description?: string
          p_epub_bytes: number
          p_genre?: string
          p_genre_source?: string
          p_language?: string
          p_sha256: string
          p_subjects: string[]
          p_title: string
          p_user_id: string
        }
        Returns: {
          cover_object_path: string
          epub_path: string
        }[]
      }
      save_progress: {
        Args: {
          p_book_id: string
          p_cfi: string
          p_percentage: number
          p_updated_at: string
        }
        Returns: boolean
      }
      save_word: {
        Args: {
          p_book_id?: string
          p_cfi?: string
          p_headword: string
          p_meanings?: string[]
          p_pos?: string
          p_sentence?: string
        }
        Returns: string
      }
      saved_word_forms: { Args: never; Returns: Json }
      unique_username: { Args: { base: string }; Returns: string }
      username_available: { Args: { candidate: string }; Returns: boolean }
      visitors_today: { Args: never; Returns: number }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
