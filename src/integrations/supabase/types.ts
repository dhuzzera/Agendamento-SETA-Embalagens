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
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: number
          travel_buffer_minutes: number
          updated_at: string
        }
        Insert: {
          id?: number
          travel_buffer_minutes?: number
          updated_at?: string
        }
        Update: {
          id?: number
          travel_buffer_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          city: string | null
          client_id: string
          created_at: string
          end_time: string
          id: string
          internal_notes: string | null
          location: string | null
          meeting_type: string
          notes: string | null
          representative_id: string
          start_time: string
          state: string | null
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          appointment_date: string
          city?: string | null
          client_id: string
          created_at?: string
          end_time: string
          id?: string
          internal_notes?: string | null
          location?: string | null
          meeting_type?: string
          notes?: string | null
          representative_id: string
          start_time: string
          state?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          city?: string | null
          client_id?: string
          created_at?: string
          end_time?: string
          id?: string
          internal_notes?: string | null
          location?: string | null
          meeting_type?: string
          notes?: string | null
          representative_id?: string
          start_time?: string
          state?: string | null
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availabilities: {
        Row: {
          active: boolean
          created_at: string
          end_time: string
          id: string
          meeting_duration_min: number
          representative_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_time: string
          id?: string
          meeting_duration_min?: number
          representative_id: string
          start_time: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          end_time?: string
          id?: string
          meeting_duration_min?: number
          representative_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availabilities_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_changes: {
        Row: {
          action: string
          affected_appointment_ids: string[]
          availability_id: string | null
          changed_by: string | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          representative_id: string
        }
        Insert: {
          action: string
          affected_appointment_ids?: string[]
          availability_id?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          representative_id: string
        }
        Update: {
          action?: string
          affected_appointment_ids?: string[]
          availability_id?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          representative_id?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          block_date: string
          created_at: string
          end_time: string | null
          id: string
          reason: string | null
          representative_id: string
          start_time: string | null
        }
        Insert: {
          block_date: string
          created_at?: string
          end_time?: string | null
          id?: string
          reason?: string | null
          representative_id: string
          start_time?: string | null
        }
        Update: {
          block_date?: string
          created_at?: string
          end_time?: string | null
          id?: string
          reason?: string | null
          representative_id?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          created_at: string
          id: string
          metric_name: string
          navigation_type: string | null
          rating: string | null
          route: string
          user_agent: string | null
          user_id: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric_name: string
          navigation_type?: string | null
          rating?: string | null
          route: string
          user_agent?: string | null
          user_id?: string | null
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metric_name?: string
          navigation_type?: string | null
          rating?: string | null
          route?: string
          user_agent?: string | null
          user_id?: string | null
          value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          allow_online: boolean
          allow_presencial: boolean
          avatar_url: string | null
          bio: string | null
          calendar_token: string
          created_at: string
          email: string
          full_name: string
          id: string
          must_change_password: boolean
          phone: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_online?: boolean
          allow_presencial?: boolean
          avatar_url?: string | null
          bio?: string | null
          calendar_token?: string
          created_at?: string
          email: string
          full_name: string
          id: string
          must_change_password?: boolean
          phone?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_online?: boolean
          allow_presencial?: boolean
          avatar_url?: string | null
          bio?: string | null
          calendar_token?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          must_change_password?: boolean
          phone?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "representative"
      appointment_status:
        | "scheduled"
        | "completed"
        | "cancelled"
        | "rescheduled"
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
  public: {
    Enums: {
      app_role: ["admin", "representative"],
      appointment_status: [
        "scheduled",
        "completed",
        "cancelled",
        "rescheduled",
      ],
    },
  },
} as const
