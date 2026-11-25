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
  public: {
    Tables: {
      accounts: {
        Row: {
          account_type: string
          client_id: string
          description: string
          detail_type: string
          id: string
          is_active: boolean
          name: string
          number: string
          parent_id: string | null
          tax_line: string
        }
        Insert: {
          account_type: string
          client_id: string
          description?: string
          detail_type?: string
          id?: string
          is_active?: boolean
          name: string
          number: string
          parent_id?: string | null
          tax_line?: string
        }
        Update: {
          account_type?: string
          client_id?: string
          description?: string
          detail_type?: string
          id?: string
          is_active?: boolean
          name?: string
          number?: string
          parent_id?: string | null
          tax_line?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      activity: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          client_id: string | null
          created_at: string
          detail: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name: string
          client_id?: string | null
          created_at?: string
          detail?: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          client_id?: string | null
          created_at?: string
          detail?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          at: string
          client_id: string
          id: string
          new_data: Json | null
          old_data: Json | null
          row_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          at?: string
          client_id: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          row_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          at?: string
          client_id?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_access: {
        Row: {
          approved_at: string | null
          can_enter: boolean
          can_upload: boolean
          client_id: string
          revoked_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          can_enter?: boolean
          can_upload?: boolean
          client_id: string
          revoked_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          can_enter?: boolean
          can_upload?: boolean
          client_id?: string
          revoked_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_access_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invites: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          status: string
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          status?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          status?: string
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          accounting_method: string
          address: string
          archived: boolean
          assignee_id: string | null
          base_currency: string
          closing_date: string | null
          contact_email: string
          contact_name: string
          created_at: string
          dba: string
          ein: string
          entity_type: string
          firm_id: string | null
          fiscal_year_start: number
          id: string
          industry: string
          legal_name: string
          name: string
          sales_tax: boolean
        }
        Insert: {
          accounting_method?: string
          address?: string
          archived?: boolean
          assignee_id?: string | null
          base_currency?: string
          closing_date?: string | null
          contact_email?: string
          contact_name?: string
          created_at?: string
          dba?: string
          ein?: string
          entity_type?: string
          firm_id?: string | null
          fiscal_year_start?: number
          id?: string
          industry?: string
          legal_name?: string
          name: string
          sales_tax?: boolean
        }
        Update: {
          accounting_method?: string
          address?: string
          archived?: boolean
          assignee_id?: string | null
          base_currency?: string
          closing_date?: string | null
          contact_email?: string
          contact_name?: string
          created_at?: string
          dba?: string
          ein?: string
          entity_type?: string
          firm_id?: string | null
          fiscal_year_start?: number
          id?: string
          industry?: string
          legal_name?: string
          name?: string
          sales_tax?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clients_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firm"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string
          client_id: string
          email: string
          id: string
          is_1099: boolean
          is_active: boolean
          kind: string
          name: string
          phone: string
          tin: string
          w9_on_file: boolean
        }
        Insert: {
          address?: string
          client_id: string
          email?: string
          id?: string
          is_1099?: boolean
          is_active?: boolean
          kind: string
          name: string
          phone?: string
          tin?: string
          w9_on_file?: boolean
        }
        Update: {
          address?: string
          client_id?: string
          email?: string
          id?: string
          is_1099?: boolean
          is_active?: boolean
          kind?: string
          name?: string
          phone?: string
          tin?: string
          w9_on_file?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_folders: {
        Row: {
          client_id: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          client_id: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          client_id?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doc_folders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "doc_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          category: string
          client_id: string
          created_at: string
          created_by: string | null
          fulfilled_document_id: string | null
          id: string
          note: string | null
          period: string
          status: string
        }
        Insert: {
          category: string
          client_id: string
          created_at?: string
          created_by?: string | null
          fulfilled_document_id?: string | null
          id?: string
          note?: string | null
          period: string
          status?: string
        }
        Update: {
          category?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          fulfilled_document_id?: string | null
          id?: string
          note?: string | null
          period?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          bundle_id: string | null
          bundle_index: number
          category: string
          client_id: string
          created_at: string
          deleted_at: string | null
          file_bytes: string
          folder_id: string | null
          id: string
          mime_type: string
          note: string | null
          original_filename: string
          parse_error: string | null
          parse_status: string
          parse_summary: Json | null
          period: string
          preview_bytes: string | null
          rejection_reason: string | null
          relative_path: string
          request_id: string | null
          size_bytes: number
          status: string
          uploaded_by: string | null
        }
        Insert: {
          bundle_id?: string | null
          bundle_index?: number
          category: string
          client_id: string
          created_at?: string
          deleted_at?: string | null
          file_bytes: string
          folder_id?: string | null
          id?: string
          mime_type: string
          note?: string | null
          original_filename: string
          parse_error?: string | null
          parse_status?: string
          parse_summary?: Json | null
          period: string
          preview_bytes?: string | null
          rejection_reason?: string | null
          relative_path?: string
          request_id?: string | null
          size_bytes: number
          status?: string
          uploaded_by?: string | null
        }
        Update: {
          bundle_id?: string | null
          bundle_index?: number
          category?: string
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          file_bytes?: string
          folder_id?: string | null
          id?: string
          mime_type?: string
          note?: string | null
          original_filename?: string
          parse_error?: string | null
          parse_status?: string
          parse_summary?: Json | null
          period?: string
          preview_bytes?: string | null
          rejection_reason?: string | null
          relative_path?: string
          request_id?: string | null
          size_bytes?: number
          status?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "doc_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_stages: {
        Row: {
          assignee_id: string | null
          blocker_note: string | null
          engagement_id: string
          id: string
          name: string
          percent: number
          position: number
          signed_off_by: string | null
          status: string
          updated_at: string
          weight: number
        }
        Insert: {
          assignee_id?: string | null
          blocker_note?: string | null
          engagement_id: string
          id?: string
          name: string
          percent?: number
          position: number
          signed_off_by?: string | null
          status?: string
          updated_at?: string
          weight: number
        }
        Update: {
          assignee_id?: string | null
          blocker_note?: string | null
          engagement_id?: string
          id?: string
          name?: string
          percent?: number
          position?: number
          signed_off_by?: string | null
          status?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "engagement_stages_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_stages_engagement_id_fkey"
            columns: ["engagement_id"]
            isOneToOne: false
            referencedRelation: "engagements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_stages_signed_off_by_fkey"
            columns: ["signed_off_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagements: {
        Row: {
          client_id: string
          created_at: string
          due_date: string
          id: string
          period: string
          status: string
        }
        Insert: {
          client_id: string
          created_at?: string
          due_date: string
          id?: string
          period: string
          status?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          due_date?: string
          id?: string
          period?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      firm: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      firm_members: {
        Row: {
          firm_id: string
          user_id: string
        }
        Insert: {
          firm_id: string
          user_id: string
        }
        Update: {
          firm_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_members_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firm"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          entry_date: string
          entry_number: number
          id: string
          memo: string
          override_note: string | null
          source: string
          voided: boolean
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          entry_date: string
          entry_number: number
          id?: string
          memo?: string
          override_note?: string | null
          source?: string
          voided?: boolean
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          entry_date?: string
          entry_number?: number
          id?: string
          memo?: string
          override_note?: string | null
          source?: string
          voided?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          client_id: string
          contact_id: string | null
          credit_cents: number
          debit_cents: number
          description: string
          entry_id: string
          id: string
        }
        Insert: {
          account_id: string
          client_id: string
          contact_id?: string | null
          credit_cents?: number
          debit_cents?: number
          description?: string
          entry_id: string
          id?: string
        }
        Update: {
          account_id?: string
          client_id?: string
          contact_id?: string | null
          credit_cents?: number
          debit_cents?: number
          description?: string
          entry_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          last_read_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          client_id: string
          id: string
          last_message_at: string
        }
        Insert: {
          client_id: string
          id?: string
          last_message_at?: string
        }
        Update: {
          client_id?: string
          id?: string
          last_message_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_id: string
          author_is_staff: boolean
          body: string
          client_id: string
          created_at: string
          document_id: string | null
          id: string
          request_id: string | null
          thread_id: string
        }
        Insert: {
          author_id: string
          author_is_staff?: boolean
          body: string
          client_id: string
          created_at?: string
          document_id?: string | null
          id?: string
          request_id?: string | null
          thread_id: string
        }
        Update: {
          author_id?: string
          author_is_staff?: boolean
          body?: string
          client_id?: string
          created_at?: string
          document_id?: string | null
          id?: string
          request_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          client_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          status: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          status?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account: string
          amount: number
          amount_cents: number
          bank_account_id: string | null
          category: string
          category_account_id: string | null
          client_id: string
          confidence: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          direction: string
          document_id: string | null
          due_date: string | null
          entry_id: string | null
          id: string
          kind: string
          paid: boolean
          payee: string
          source: string
          status: string
          txn_date: string
          updated_at: string
        }
        Insert: {
          account?: string
          amount: number
          amount_cents?: number
          bank_account_id?: string | null
          category?: string
          category_account_id?: string | null
          client_id: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          direction: string
          document_id?: string | null
          due_date?: string | null
          entry_id?: string | null
          id?: string
          kind?: string
          paid?: boolean
          payee?: string
          source?: string
          status?: string
          txn_date: string
          updated_at?: string
        }
        Update: {
          account?: string
          amount?: number
          amount_cents?: number
          bank_account_id?: string | null
          category?: string
          category_account_id?: string | null
          client_id?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          direction?: string
          document_id?: string | null
          due_date?: string | null
          entry_id?: string | null
          id?: string
          kind?: string
          paid?: boolean
          payee?: string
          source?: string
          status?: string
          txn_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_account_id_fkey"
            columns: ["category_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      can_work_books: { Args: { _user_id: string }; Returns: boolean }
      categorize_transaction: {
        Args: { _bank: string; _category: string; _txn: string }
        Returns: string
      }
      claim_client_invite: { Args: { _token: string }; Returns: string }
      client_can_enter: { Args: { _company: string }; Returns: boolean }
      client_can_upload: { Args: { _company: string }; Returns: boolean }
      delete_transaction: { Args: { _txn: string }; Returns: undefined }
      has_company_access: { Args: { _company: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active: { Args: { _user_id: string }; Returns: boolean }
      is_company_client: { Args: { _company: string }; Returns: boolean }
      is_firm_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      my_client_id: { Args: { _user_id: string }; Returns: string }
      post_journal_entry: {
        Args: {
          _company: string
          _date: string
          _lines: Json
          _memo: string
          _override_note?: string
        }
        Returns: string
      }
      seed_chart: { Args: { _company: string }; Returns: undefined }
      set_client_access: {
        Args: {
          _company: string
          _enter: boolean
          _status: string
          _upload: boolean
          _user: string
        }
        Returns: undefined
      }
      shares_firm: { Args: { _user: string }; Returns: boolean }
      thread_summaries: {
        Args: never
        Returns: {
          client_id: string
          client_name: string
          last_body: string
          last_message_at: string
          thread_id: string
          unread: number
          unread_from_client: number
        }[]
      }
      void_journal_entry: { Args: { _entry: string }; Returns: undefined }
    }
    Enums: {
      app_role: "owner" | "admin" | "preparer" | "reviewer" | "client"
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
  public: {
    Enums: {
      app_role: ["owner", "admin", "preparer", "reviewer", "client"],
    },
  },
} as const
