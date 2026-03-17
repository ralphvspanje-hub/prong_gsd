export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          call_count: number;
          endpoint: string;
          id: string;
          ip_address: string | null;
          user_id: string | null;
          window_start: string;
        };
        Insert: {
          call_count?: number;
          endpoint: string;
          id?: string;
          ip_address?: string | null;
          user_id?: string | null;
          window_start?: string;
        };
        Update: {
          call_count?: number;
          endpoint?: string;
          id?: string;
          ip_address?: string | null;
          user_id?: string | null;
          window_start?: string;
        };
        Relationships: [];
      };
      curated_resources: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          max_level: number | null;
          min_level: number | null;
          platform: string;
          resource_type: string;
          skill_area: string;
          tags: string[] | null;
          title: string;
          updated_at: string | null;
          url: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          max_level?: number | null;
          min_level?: number | null;
          platform: string;
          resource_type: string;
          skill_area: string;
          tags?: string[] | null;
          title: string;
          updated_at?: string | null;
          url: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          max_level?: number | null;
          min_level?: number | null;
          platform?: string;
          resource_type?: string;
          skill_area?: string;
          tags?: string[] | null;
          title?: string;
          updated_at?: string | null;
          url?: string;
        };
        Relationships: [];
      };
      cycles: {
        Row: {
          bridge_count: number | null;
          completed_at: string | null;
          cycle_number: number;
          id: string;
          pillar_id: string | null;
          started_at: string;
          status: string | null;
          theme: string | null;
          user_id: string;
        };
        Insert: {
          bridge_count?: number | null;
          completed_at?: string | null;
          cycle_number?: number;
          id?: string;
          pillar_id?: string | null;
          started_at?: string;
          status?: string | null;
          theme?: string | null;
          user_id: string;
        };
        Update: {
          bridge_count?: number | null;
          completed_at?: string | null;
          cycle_number?: number;
          id?: string;
          pillar_id?: string | null;
          started_at?: string;
          status?: string | null;
          theme?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cycles_pillar_id_fkey";
            columns: ["pillar_id"];
            isOneToOne: false;
            referencedRelation: "pillars";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_plans: {
        Row: {
          crashcourse_type: string | null;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          pacing_profile: string;
          plan_outline: Json;
          plan_type: string | null;
          total_weeks: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          crashcourse_type?: string | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          pacing_profile: string;
          plan_outline: Json;
          plan_type?: string | null;
          total_weeks: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          crashcourse_type?: string | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          pacing_profile?: string;
          plan_outline?: Json;
          plan_type?: string | null;
          total_weeks?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      mentor_conversations: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          role: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      mistake_journal: {
        Row: {
          category: string | null;
          created_at: string | null;
          id: string;
          lesson_learned: string | null;
          mistake_description: string;
          mock_interview_id: string | null;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          id?: string;
          lesson_learned?: string | null;
          mistake_description: string;
          mock_interview_id?: string | null;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          id?: string;
          lesson_learned?: string | null;
          mistake_description?: string;
          mock_interview_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mistake_journal_mock_interview_id_fkey";
            columns: ["mock_interview_id"];
            isOneToOne: false;
            referencedRelation: "mock_interviews";
            referencedColumns: ["id"];
          },
        ];
      };
      mock_interviews: {
        Row: {
          ai_feedback: Json | null;
          company_context: string | null;
          completed_at: string | null;
          created_at: string | null;
          duration_minutes: number | null;
          id: string;
          interview_type: string;
          messages: Json | null;
          plan_task_id: string | null;
          score: number | null;
          status: string | null;
          target_role: string | null;
          user_id: string;
        };
        Insert: {
          ai_feedback?: Json | null;
          company_context?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          duration_minutes?: number | null;
          id?: string;
          interview_type: string;
          messages?: Json | null;
          plan_task_id?: string | null;
          score?: number | null;
          status?: string | null;
          target_role?: string | null;
          user_id: string;
        };
        Update: {
          ai_feedback?: Json | null;
          company_context?: string | null;
          completed_at?: string | null;
          created_at?: string | null;
          duration_minutes?: number | null;
          id?: string;
          interview_type?: string;
          messages?: Json | null;
          plan_task_id?: string | null;
          score?: number | null;
          status?: string | null;
          target_role?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mock_interviews_plan_task_id_fkey";
            columns: ["plan_task_id"];
            isOneToOne: false;
            referencedRelation: "plan_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      onboarding_conversations: {
        Row: {
          created_at: string;
          id: string;
          messages: Json | null;
          status: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          messages?: Json | null;
          status?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          messages?: Json | null;
          status?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      personal_notes: {
        Row: {
          created_at: string;
          id: string;
          note: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      phase_weights: {
        Row: {
          id: string;
          phase_id: string;
          pillar_id: string;
          weight: number;
        };
        Insert: {
          id?: string;
          phase_id: string;
          pillar_id: string;
          weight?: number;
        };
        Update: {
          id?: string;
          phase_id?: string;
          pillar_id?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "phase_weights_phase_id_fkey";
            columns: ["phase_id"];
            isOneToOne: false;
            referencedRelation: "phases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "phase_weights_pillar_id_fkey";
            columns: ["pillar_id"];
            isOneToOne: false;
            referencedRelation: "pillars";
            referencedColumns: ["id"];
          },
        ];
      };
      phases: {
        Row: {
          goal: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          sort_order: number | null;
          timeline_end: string | null;
          timeline_start: string | null;
          user_id: string;
        };
        Insert: {
          goal?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          sort_order?: number | null;
          timeline_end?: string | null;
          timeline_start?: string | null;
          user_id: string;
        };
        Update: {
          goal?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          sort_order?: number | null;
          timeline_end?: string | null;
          timeline_start?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      pillars: {
        Row: {
          blocks_completed_at_level: number | null;
          created_at: string;
          current_level: number;
          description: string | null;
          id: string;
          is_active: boolean | null;
          last_difficulty_signal: string | null;
          name: string;
          phase_weight: number | null;
          sort_order: number | null;
          starting_level: number;
          trend: string | null;
          user_id: string;
          why_it_matters: string | null;
        };
        Insert: {
          blocks_completed_at_level?: number | null;
          created_at?: string;
          current_level?: number;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_difficulty_signal?: string | null;
          name: string;
          phase_weight?: number | null;
          sort_order?: number | null;
          starting_level?: number;
          trend?: string | null;
          user_id: string;
          why_it_matters?: string | null;
        };
        Update: {
          blocks_completed_at_level?: number | null;
          created_at?: string;
          current_level?: number;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_difficulty_signal?: string | null;
          name?: string;
          phase_weight?: number | null;
          sort_order?: number | null;
          starting_level?: number;
          trend?: string | null;
          user_id?: string;
          why_it_matters?: string | null;
        };
        Relationships: [];
      };
      plan_blocks: {
        Row: {
          checkin_feedback: Json | null;
          completed_at: string | null;
          completion_criteria: string | null;
          context_brief: string | null;
          created_at: string | null;
          id: string;
          is_completed: boolean | null;
          pacing_note: string | null;
          pillar_id: string;
          plan_id: string;
          title: string;
          user_id: string;
          week_number: number;
          weekly_goal: string;
        };
        Insert: {
          checkin_feedback?: Json | null;
          completed_at?: string | null;
          completion_criteria?: string | null;
          context_brief?: string | null;
          created_at?: string | null;
          id?: string;
          is_completed?: boolean | null;
          pacing_note?: string | null;
          pillar_id: string;
          plan_id: string;
          title: string;
          user_id: string;
          week_number: number;
          weekly_goal: string;
        };
        Update: {
          checkin_feedback?: Json | null;
          completed_at?: string | null;
          completion_criteria?: string | null;
          context_brief?: string | null;
          created_at?: string | null;
          id?: string;
          is_completed?: boolean | null;
          pacing_note?: string | null;
          pillar_id?: string;
          plan_id?: string;
          title?: string;
          user_id?: string;
          week_number?: number;
          weekly_goal?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_blocks_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "learning_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_tasks: {
        Row: {
          action: string;
          attempt_count: number;
          completed_at: string | null;
          created_at: string | null;
          estimated_time_minutes: number | null;
          id: string;
          is_completed: boolean | null;
          last_feedback: string | null;
          plan_block_id: string;
          platform: string;
          resource_type: string;
          search_query: string | null;
          task_order: number;
          url: string | null;
          user_answers: Json | null;
          user_id: string;
          why_text: string | null;
        };
        Insert: {
          action: string;
          attempt_count?: number;
          completed_at?: string | null;
          created_at?: string | null;
          estimated_time_minutes?: number | null;
          id?: string;
          is_completed?: boolean | null;
          last_feedback?: string | null;
          plan_block_id: string;
          platform: string;
          resource_type: string;
          search_query?: string | null;
          task_order: number;
          url?: string | null;
          user_answers?: Json | null;
          user_id: string;
          why_text?: string | null;
        };
        Update: {
          action?: string;
          attempt_count?: number;
          completed_at?: string | null;
          created_at?: string | null;
          estimated_time_minutes?: number | null;
          id?: string;
          is_completed?: boolean | null;
          last_feedback?: string | null;
          plan_block_id?: string;
          platform?: string;
          resource_type?: string;
          search_query?: string | null;
          task_order?: number;
          url?: string | null;
          user_answers?: Json | null;
          user_id?: string;
          why_text?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "plan_tasks_plan_block_id_fkey";
            columns: ["plan_block_id"];
            isOneToOne: false;
            referencedRelation: "plan_blocks";
            referencedColumns: ["id"];
          },
        ];
      };
      progress_archive: {
        Row: {
          avg_difficulty: number | null;
          avg_value: number | null;
          cycle_id: string | null;
          id: string;
          level_change: string | null;
          summary: string | null;
        };
        Insert: {
          avg_difficulty?: number | null;
          avg_value?: number | null;
          cycle_id?: string | null;
          id?: string;
          level_change?: string | null;
          summary?: string | null;
        };
        Update: {
          avg_difficulty?: number | null;
          avg_value?: number | null;
          cycle_id?: string | null;
          id?: string;
          level_change?: string | null;
          summary?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "progress_archive_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "cycles";
            referencedColumns: ["id"];
          },
        ];
      };
      topic_map: {
        Row: {
          cluster_name: string;
          cross_pillar_connections: string | null;
          difficulty_level: number | null;
          id: string;
          pillar_id: string;
          priority_order: number | null;
          status: string | null;
          subtopics: string[] | null;
        };
        Insert: {
          cluster_name: string;
          cross_pillar_connections?: string | null;
          difficulty_level?: number | null;
          id?: string;
          pillar_id: string;
          priority_order?: number | null;
          status?: string | null;
          subtopics?: string[] | null;
        };
        Update: {
          cluster_name?: string;
          cross_pillar_connections?: string | null;
          difficulty_level?: number | null;
          id?: string;
          pillar_id?: string;
          priority_order?: number | null;
          status?: string | null;
          subtopics?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "topic_map_pillar_id_fkey";
            columns: ["pillar_id"];
            isOneToOne: false;
            referencedRelation: "pillars";
            referencedColumns: ["id"];
          },
        ];
      };
      units: {
        Row: {
          bridge_prerequisite_for: string | null;
          content: string | null;
          created_at: string;
          cycle_id: string;
          difficulty_level: number | null;
          feedback_difficulty: string | null;
          feedback_given_at: string | null;
          feedback_note: string | null;
          feedback_value: string | null;
          file_path_equivalent: string | null;
          id: string;
          is_bonus: boolean | null;
          is_bridge: boolean | null;
          is_pending_feedback: boolean | null;
          pillar_id: string | null;
          section_number: number;
          section_type: string | null;
          topic: string | null;
          unit_role: string;
        };
        Insert: {
          bridge_prerequisite_for?: string | null;
          content?: string | null;
          created_at?: string;
          cycle_id: string;
          difficulty_level?: number | null;
          feedback_difficulty?: string | null;
          feedback_given_at?: string | null;
          feedback_note?: string | null;
          feedback_value?: string | null;
          file_path_equivalent?: string | null;
          id?: string;
          is_bonus?: boolean | null;
          is_bridge?: boolean | null;
          is_pending_feedback?: boolean | null;
          pillar_id?: string | null;
          section_number?: number;
          section_type?: string | null;
          topic?: string | null;
          unit_role?: string;
        };
        Update: {
          bridge_prerequisite_for?: string | null;
          content?: string | null;
          created_at?: string;
          cycle_id?: string;
          difficulty_level?: number | null;
          feedback_difficulty?: string | null;
          feedback_given_at?: string | null;
          feedback_note?: string | null;
          feedback_value?: string | null;
          file_path_equivalent?: string | null;
          id?: string;
          is_bonus?: boolean | null;
          is_bridge?: boolean | null;
          is_pending_feedback?: boolean | null;
          pillar_id?: string | null;
          section_number?: number;
          section_type?: string | null;
          topic?: string | null;
          unit_role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "units_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "cycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "units_pillar_id_fkey";
            columns: ["pillar_id"];
            isOneToOne: false;
            referencedRelation: "pillars";
            referencedColumns: ["id"];
          },
        ];
      };
      user_profile: {
        Row: {
          created_at: string;
          current_role: string | null;
          cycle_length: number | null;
          daily_time_commitment: number | null;
          id: string;
          interview_company: string | null;
          interview_company_context: string | null;
          interview_date: string | null;
          interview_format: string | null;
          interview_intensity: string | null;
          interview_target_role: string | null;
          interview_weak_areas: string[] | null;
          job_situation: string | null;
          job_timeline_weeks: number | null;
          learning_cadence: string | null;
          learning_style: string | null;
          linkedin_context: string | null;
          long_term_ambition: string | null;
          mentor_name: string | null;
          name: string | null;
          pacing_profile: string | null;
          resume_text: string | null;
          target_role: string | null;
          time_commitment: string | null;
          tool_setup: Json | null;
          unique_differentiator: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          current_role?: string | null;
          cycle_length?: number | null;
          daily_time_commitment?: number | null;
          id?: string;
          interview_company?: string | null;
          interview_company_context?: string | null;
          interview_date?: string | null;
          interview_format?: string | null;
          interview_intensity?: string | null;
          interview_target_role?: string | null;
          interview_weak_areas?: string[] | null;
          job_situation?: string | null;
          job_timeline_weeks?: number | null;
          learning_cadence?: string | null;
          learning_style?: string | null;
          linkedin_context?: string | null;
          long_term_ambition?: string | null;
          mentor_name?: string | null;
          name?: string | null;
          pacing_profile?: string | null;
          resume_text?: string | null;
          target_role?: string | null;
          time_commitment?: string | null;
          tool_setup?: Json | null;
          unique_differentiator?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          current_role?: string | null;
          cycle_length?: number | null;
          daily_time_commitment?: number | null;
          id?: string;
          interview_company?: string | null;
          interview_company_context?: string | null;
          interview_date?: string | null;
          interview_format?: string | null;
          interview_intensity?: string | null;
          interview_target_role?: string | null;
          interview_weak_areas?: string[] | null;
          job_situation?: string | null;
          job_timeline_weeks?: number | null;
          learning_cadence?: string | null;
          learning_style?: string | null;
          linkedin_context?: string | null;
          long_term_ambition?: string | null;
          mentor_name?: string | null;
          name?: string | null;
          pacing_profile?: string | null;
          resume_text?: string | null;
          target_role?: string | null;
          time_commitment?: string | null;
          tool_setup?: Json | null;
          unique_differentiator?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_progress: {
        Row: {
          created_at: string | null;
          current_day: number | null;
          current_streak: number | null;
          id: string;
          last_activity_date: string | null;
          longest_streak: number | null;
          total_tasks_completed: number | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          current_day?: number | null;
          current_streak?: number | null;
          id?: string;
          last_activity_date?: string | null;
          longest_streak?: number | null;
          total_tasks_completed?: number | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          current_day?: number | null;
          current_streak?: number | null;
          id?: string;
          last_activity_date?: string | null;
          longest_streak?: number | null;
          total_tasks_completed?: number | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
