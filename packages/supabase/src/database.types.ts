// ---------------------------------------------------------------------------
// GENERATED FILE — do not edit by hand.
// Regenerate with:  pnpm db:types
// Source: scripts/gen-db-types.mjs, read straight from the PostgreSQL catalog.
// ---------------------------------------------------------------------------

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      amenities: {
        Row: {
          id: string
          community_id: string
          name: string
          description: string | null
          capacity: number | null
          opens_at: string
          closes_at: string
          slot_minutes: number
          max_hours_per_booking: number
          requires_approval: boolean
          booking_fee: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          name: string
          description?: string | null
          capacity?: number | null
          opens_at?: string
          closes_at?: string
          slot_minutes?: number
          max_hours_per_booking?: number
          requires_approval?: boolean
          booking_fee?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          name?: string
          description?: string | null
          capacity?: number | null
          opens_at?: string
          closes_at?: string
          slot_minutes?: number
          max_hours_per_booking?: number
          requires_approval?: boolean
          booking_fee?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amenities_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          }
        ]
      }
      amenity_bookings: {
        Row: {
          id: string
          amenity_id: string
          community_id: string
          membership_id: string
          unit_id: string | null
          starts_at: string
          ends_at: string
          guests: number
          status: Database["public"]["Enums"]["booking_status"]
          notes: string | null
          channel: Database["public"]["Enums"]["origin_channel"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          amenity_id: string
          community_id: string
          membership_id: string
          unit_id?: string | null
          starts_at: string
          ends_at: string
          guests?: number
          status?: Database["public"]["Enums"]["booking_status"]
          notes?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          amenity_id?: string
          community_id?: string
          membership_id?: string
          unit_id?: string | null
          starts_at?: string
          ends_at?: string
          guests?: number
          status?: Database["public"]["Enums"]["booking_status"]
          notes?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amenity_bookings_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amenity_bookings_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amenity_bookings_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amenity_bookings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          }
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          membership_id: string
          read_at: string
        }
        Insert: {
          announcement_id: string
          membership_id: string
          read_at?: string
        }
        Update: {
          announcement_id?: string
          membership_id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          }
        ]
      }
      announcements: {
        Row: {
          id: string
          community_id: string
          author_id: string | null
          title: string
          body: string
          audience: Database["public"]["Enums"]["announcement_audience"]
          is_pinned: boolean
          published_at: string
          expires_at: string | null
          attachments: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          author_id?: string | null
          title: string
          body: string
          audience?: Database["public"]["Enums"]["announcement_audience"]
          is_pinned?: boolean
          published_at?: string
          expires_at?: string | null
          attachments?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          author_id?: string | null
          title?: string
          body?: string
          audience?: Database["public"]["Enums"]["announcement_audience"]
          is_pinned?: boolean
          published_at?: string
          expires_at?: string | null
          attachments?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          }
        ]
      }
      api_key_secrets: {
        Row: {
          api_key_id: string
          key_hash: string
        }
        Insert: {
          api_key_id: string
          key_hash: string
        }
        Update: {
          api_key_id?: string
          key_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_key_secrets_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          }
        ]
      }
      api_keys: {
        Row: {
          id: string
          community_id: string
          name: string
          key_prefix: string
          scopes: string[]
          acts_as: string | null
          created_by: string | null
          last_used_at: string | null
          expires_at: string | null
          revoked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          name: string
          key_prefix: string
          scopes?: string[]
          acts_as?: string | null
          created_by?: string | null
          last_used_at?: string | null
          expires_at?: string | null
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          name?: string
          key_prefix?: string
          scopes?: string[]
          acts_as?: string | null
          created_by?: string | null
          last_used_at?: string | null
          expires_at?: string | null
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_acts_as_fkey"
            columns: ["acts_as"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          id: string
          community_id: string | null
          actor_user_id: string | null
          actor_api_key: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          channel: Database["public"]["Enums"]["origin_channel"]
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          community_id?: string | null
          actor_user_id?: string | null
          actor_api_key?: string | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string | null
          actor_user_id?: string | null
          actor_api_key?: string | null
          action?: string
          entity_type?: string | null
          entity_id?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_api_key_fkey"
            columns: ["actor_api_key"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          }
        ]
      }
      communities: {
        Row: {
          id: string
          slug: string
          name: string
          address_line1: string | null
          address_line2: string | null
          city: string | null
          state: string | null
          postal_code: string | null
          country: string
          timezone: string
          currency: string
          logo_url: string | null
          settings: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          name: string
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string
          timezone?: string
          currency?: string
          logo_url?: string | null
          settings?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string
          timezone?: string
          currency?: string
          logo_url?: string | null
          settings?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      device_push_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          platform: string
          app_version: string | null
          last_seen_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token: string
          platform: string
          app_version?: string | null
          last_seen_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          platform?: string
          app_version?: string | null
          last_seen_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      invite_code_attempts: {
        Row: {
          id: string
          user_id: string | null
          code_tried: string
          succeeded: boolean
          channel: Database["public"]["Enums"]["origin_channel"]
          attempted_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          code_tried: string
          succeeded?: boolean
          channel?: Database["public"]["Enums"]["origin_channel"]
          attempted_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          code_tried?: string
          succeeded?: boolean
          channel?: Database["public"]["Enums"]["origin_channel"]
          attempted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_code_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      invite_code_redemptions: {
        Row: {
          id: string
          invite_code_id: string
          user_id: string
          membership_id: string | null
          channel: Database["public"]["Enums"]["origin_channel"]
          redeemed_at: string
        }
        Insert: {
          id?: string
          invite_code_id: string
          user_id: string
          membership_id?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          redeemed_at?: string
        }
        Update: {
          id?: string
          invite_code_id?: string
          user_id?: string
          membership_id?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_code_redemptions_invite_code_id_fkey"
            columns: ["invite_code_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_code_redemptions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_code_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      invite_codes: {
        Row: {
          id: string
          community_id: string
          code: string
          label: string | null
          role: Database["public"]["Enums"]["member_role"]
          unit_id: string | null
          relation: Database["public"]["Enums"]["occupant_relation"]
          max_uses: number | null
          used_count: number
          expires_at: string | null
          revoked_at: string | null
          revoked_by: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          code: string
          label?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          unit_id?: string | null
          relation?: Database["public"]["Enums"]["occupant_relation"]
          max_uses?: number | null
          used_count?: number
          expires_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          code?: string
          label?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          unit_id?: string | null
          relation?: Database["public"]["Enums"]["occupant_relation"]
          max_uses?: number | null
          used_count?: number
          expires_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          }
        ]
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          description: string
          quantity: number
          unit_price: number
          amount: number | null
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          description: string
          quantity?: number
          unit_price?: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          description?: string
          quantity?: number
          unit_price?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          }
        ]
      }
      invoices: {
        Row: {
          id: string
          community_id: string
          unit_id: string
          number: number
          title: string
          period_start: string | null
          period_end: string | null
          issue_date: string
          due_date: string
          status: Database["public"]["Enums"]["invoice_status"]
          currency: string
          subtotal: number
          tax: number
          total: number
          amount_paid: number
          balance_due: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          unit_id: string
          number?: number
          title?: string
          period_start?: string | null
          period_end?: string | null
          issue_date?: string
          due_date?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          currency?: string
          subtotal?: number
          tax?: number
          total?: number
          amount_paid?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          unit_id?: string
          number?: number
          title?: string
          period_start?: string | null
          period_end?: string | null
          issue_date?: string
          due_date?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          currency?: string
          subtotal?: number
          tax?: number
          total?: number
          amount_paid?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          }
        ]
      }
      memberships: {
        Row: {
          id: string
          community_id: string
          user_id: string
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["membership_status"]
          invited_via: string | null
          joined_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          user_id: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          invited_via?: string | null
          joined_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          invited_via?: string | null
          joined_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_invited_via_fkey"
            columns: ["invited_via"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          community_id: string | null
          user_id: string
          kind: string
          title: string
          body: string | null
          data: Json
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          community_id?: string | null
          user_id: string
          kind: string
          title: string
          body?: string | null
          data?: Json
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          community_id?: string | null
          user_id?: string
          kind?: string
          title?: string
          body?: string | null
          data?: Json
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      payments: {
        Row: {
          id: string
          community_id: string
          invoice_id: string | null
          unit_id: string | null
          paid_by: string | null
          amount: number
          currency: string
          method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["payment_status"]
          reference: string | null
          gateway_payload: Json
          paid_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          invoice_id?: string | null
          unit_id?: string | null
          paid_by?: string | null
          amount: number
          currency?: string
          method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["payment_status"]
          reference?: string | null
          gateway_payload?: Json
          paid_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          invoice_id?: string | null
          unit_id?: string | null
          paid_by?: string | null
          amount?: number
          currency?: string
          method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["payment_status"]
          reference?: string | null
          gateway_payload?: Json
          paid_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          phone: string | null
          avatar_url: string | null
          locale: string
          is_platform_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          locale?: string
          is_platform_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          avatar_url?: string | null
          locale?: string
          is_platform_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      service_request_comments: {
        Row: {
          id: string
          request_id: string
          author_id: string | null
          body: string
          is_internal: boolean
          channel: Database["public"]["Enums"]["origin_channel"]
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          author_id?: string | null
          body: string
          is_internal?: boolean
          channel?: Database["public"]["Enums"]["origin_channel"]
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          author_id?: string | null
          body?: string
          is_internal?: boolean
          channel?: Database["public"]["Enums"]["origin_channel"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          }
        ]
      }
      service_requests: {
        Row: {
          id: string
          community_id: string
          ticket_no: number
          unit_id: string | null
          raised_by: string | null
          assigned_to: string | null
          category: Database["public"]["Enums"]["request_category"]
          priority: Database["public"]["Enums"]["request_priority"]
          status: Database["public"]["Enums"]["request_status"]
          title: string
          description: string | null
          attachments: Json
          channel: Database["public"]["Enums"]["origin_channel"]
          acknowledged_at: string | null
          resolved_at: string | null
          closed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          ticket_no?: number
          unit_id?: string | null
          raised_by?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["request_category"]
          priority?: Database["public"]["Enums"]["request_priority"]
          status?: Database["public"]["Enums"]["request_status"]
          title: string
          description?: string | null
          attachments?: Json
          channel?: Database["public"]["Enums"]["origin_channel"]
          acknowledged_at?: string | null
          resolved_at?: string | null
          closed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          ticket_no?: number
          unit_id?: string | null
          raised_by?: string | null
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["request_category"]
          priority?: Database["public"]["Enums"]["request_priority"]
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
          description?: string | null
          attachments?: Json
          channel?: Database["public"]["Enums"]["origin_channel"]
          acknowledged_at?: string | null
          resolved_at?: string | null
          closed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          }
        ]
      }
      unit_occupants: {
        Row: {
          id: string
          unit_id: string
          membership_id: string
          relation: Database["public"]["Enums"]["occupant_relation"]
          is_primary: boolean
          moved_in_on: string | null
          moved_out_on: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          unit_id: string
          membership_id: string
          relation?: Database["public"]["Enums"]["occupant_relation"]
          is_primary?: boolean
          moved_in_on?: string | null
          moved_out_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          unit_id?: string
          membership_id?: string
          relation?: Database["public"]["Enums"]["occupant_relation"]
          is_primary?: boolean
          moved_in_on?: string | null
          moved_out_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_occupants_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_occupants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          }
        ]
      }
      units: {
        Row: {
          id: string
          community_id: string
          block: string | null
          number: string
          floor: number | null
          bedrooms: number | null
          area_sqft: number | null
          monthly_dues: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          block?: string | null
          number: string
          floor?: number | null
          bedrooms?: number | null
          area_sqft?: number | null
          monthly_dues?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          block?: string | null
          number?: string
          floor?: number | null
          bedrooms?: number | null
          area_sqft?: number | null
          monthly_dues?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          }
        ]
      }
      visitor_events: {
        Row: {
          id: string
          pass_id: string
          community_id: string
          status: Database["public"]["Enums"]["visitor_status"]
          recorded_by: string | null
          note: string | null
          occurred_at: string
        }
        Insert: {
          id?: string
          pass_id: string
          community_id: string
          status: Database["public"]["Enums"]["visitor_status"]
          recorded_by?: string | null
          note?: string | null
          occurred_at?: string
        }
        Update: {
          id?: string
          pass_id?: string
          community_id?: string
          status?: Database["public"]["Enums"]["visitor_status"]
          recorded_by?: string | null
          note?: string | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_events_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: false
            referencedRelation: "visitor_passes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_events_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          }
        ]
      }
      visitor_passes: {
        Row: {
          id: string
          community_id: string
          unit_id: string | null
          created_by: string | null
          visitor_name: string
          visitor_phone: string | null
          kind: Database["public"]["Enums"]["visitor_kind"]
          purpose: string | null
          vehicle_number: string | null
          party_size: number
          pass_code: string
          status: Database["public"]["Enums"]["visitor_status"]
          expected_at: string
          valid_until: string
          checked_in_at: string | null
          checked_out_at: string | null
          channel: Database["public"]["Enums"]["origin_channel"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          community_id: string
          unit_id?: string | null
          created_by?: string | null
          visitor_name: string
          visitor_phone?: string | null
          kind?: Database["public"]["Enums"]["visitor_kind"]
          purpose?: string | null
          vehicle_number?: string | null
          party_size?: number
          pass_code?: string
          status?: Database["public"]["Enums"]["visitor_status"]
          expected_at?: string
          valid_until?: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          community_id?: string
          unit_id?: string | null
          created_by?: string | null
          visitor_name?: string
          visitor_phone?: string | null
          kind?: Database["public"]["Enums"]["visitor_kind"]
          purpose?: string | null
          vehicle_number?: string | null
          party_size?: number
          pass_code?: string
          status?: Database["public"]["Enums"]["visitor_status"]
          expected_at?: string
          valid_until?: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          channel?: Database["public"]["Enums"]["origin_channel"]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_passes_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_passes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_passes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          }
        ]
      }
      whatsapp_link_codes: {
        Row: {
          id: string
          code: string
          user_id: string
          community_id: string | null
          expires_at: string
          consumed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          user_id: string
          community_id?: string | null
          expires_at?: string
          consumed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          user_id?: string
          community_id?: string | null
          expires_at?: string
          consumed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_link_codes_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_link_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      whatsapp_links: {
        Row: {
          id: string
          phone: string
          user_id: string
          default_community_id: string | null
          verified_at: string | null
          opted_out_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          phone: string
          user_id: string
          default_community_id?: string | null
          verified_at?: string | null
          opted_out_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone?: string
          user_id?: string
          default_community_id?: string | null
          verified_at?: string | null
          opted_out_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_links_default_community_id_fkey"
            columns: ["default_community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      whatsapp_messages: {
        Row: {
          id: string
          wa_message_id: string | null
          direction: string
          phone: string
          community_id: string | null
          user_id: string | null
          body: string | null
          payload: Json
          status: string
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          wa_message_id?: string | null
          direction: string
          phone: string
          community_id?: string | null
          user_id?: string | null
          body?: string | null
          payload?: Json
          status?: string
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          wa_message_id?: string | null
          direction?: string
          phone?: string
          community_id?: string | null
          user_id?: string | null
          body?: string | null
          payload?: Json
          status?: string
          error?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {

    }
    Functions: {
      create_invite_code: {
        Args: {
        p_community_id: string
        p_role?: Database["public"]["Enums"]["member_role"]
        p_unit_id?: string
        p_relation?: Database["public"]["Enums"]["occupant_relation"]
        p_max_uses?: number
        p_expires_at?: string
        p_label?: string
      }
        Returns: Database["public"]["Tables"]["invite_codes"]["Row"]
      }
      create_whatsapp_link_code: {
        Args: {
        p_community_id?: string
      }
        Returns: Database["public"]["Tables"]["whatsapp_link_codes"]["Row"]
      }
      normalize_invite_code: {
        Args: {
        p_code: string
      }
        Returns: string
      }
      preview_invite_code: {
        Args: {
        p_code: string
      }
        Returns: {
        status: string | null
        community_name: string | null
        community_slug: string | null
        role: Database["public"]["Enums"]["member_role"] | null
        unit_label: string | null
        expires_at: string | null
      }[]
      }
      redeem_invite_code: {
        Args: {
        p_code: string
        p_channel?: Database["public"]["Enums"]["origin_channel"]
      }
        Returns: {
        status: string | null
        membership_id: string | null
        community_id: string | null
        community_name: string | null
        community_slug: string | null
        role: Database["public"]["Enums"]["member_role"] | null
        unit_id: string | null
      }[]
      }
      verify_api_key: {
        Args: {
        p_prefix: string
        p_hash: string
      }
        Returns: {
        api_key_id: string | null
        community_id: string | null
        scopes: string[] | null
        acts_as: string | null
      }[]
      }
    }
    Enums: {
      announcement_audience: "all" | "residents" | "owners" | "committee" | "staff"
      booking_status: "pending" | "confirmed" | "cancelled" | "rejected"
      invoice_status: "draft" | "issued" | "partly_paid" | "paid" | "overdue" | "void"
      member_role: "resident" | "security" | "committee" | "admin" | "owner"
      membership_status: "pending" | "active" | "suspended"
      occupant_relation: "owner" | "tenant" | "family" | "other"
      origin_channel: "web" | "mobile" | "whatsapp" | "api" | "system"
      payment_method: "upi" | "card" | "netbanking" | "bank_transfer" | "cash" | "cheque" | "other"
      payment_status: "pending" | "succeeded" | "failed" | "refunded"
      request_category: "plumbing" | "electrical" | "housekeeping" | "security" | "common_area" | "parking" | "billing" | "other"
      request_priority: "low" | "normal" | "high" | "urgent"
      request_status: "open" | "acknowledged" | "in_progress" | "resolved" | "closed" | "rejected"
      visitor_kind: "guest" | "delivery" | "cab" | "service" | "staff"
      visitor_status: "expected" | "arrived" | "departed" | "denied" | "expired" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public'];

export type Tables<T extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])> =
  (PublicSchema['Tables'] & PublicSchema['Views'])[T] extends { Row: infer R } ? R : never;

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Insert: infer I } ? I : never;

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Update: infer U } ? U : never;

export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

export type FunctionArgs<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Args'];

export type FunctionReturns<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Returns'];
