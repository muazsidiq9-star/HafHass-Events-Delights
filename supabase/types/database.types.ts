// Generated from live Supabase project gbsvwizlplzoantvkese on 2026-11-24.
// Regenerate after database schema changes with the Supabase type-generation workflow.
// This file describes client types; it is not a SQL migration or database backup.

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
      addresses: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          area_id: string | null
          city: string
          city_id: string | null
          country: string
          created_at: string
          custom_area: string | null
          custom_city: string | null
          custom_lga: string | null
          custom_location_text: string | null
          delivery_instructions: string | null
          id: string
          is_custom_location: boolean
          is_default: boolean
          label: string | null
          lga_id: string | null
          location_node_id: string | null
          phone: string
          postal_code: string | null
          recipient_name: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          area_id?: string | null
          city: string
          city_id?: string | null
          country?: string
          created_at?: string
          custom_area?: string | null
          custom_city?: string | null
          custom_lga?: string | null
          custom_location_text?: string | null
          delivery_instructions?: string | null
          id?: string
          is_custom_location?: boolean
          is_default?: boolean
          label?: string | null
          lga_id?: string | null
          location_node_id?: string | null
          phone: string
          postal_code?: string | null
          recipient_name: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          area_id?: string | null
          city?: string
          city_id?: string | null
          country?: string
          created_at?: string
          custom_area?: string | null
          custom_city?: string | null
          custom_lga?: string | null
          custom_location_text?: string | null
          delivery_instructions?: string | null
          id?: string
          is_custom_location?: boolean
          is_default?: boolean
          label?: string | null
          lga_id?: string | null
          location_node_id?: string | null
          phone?: string
          postal_code?: string | null
          recipient_name?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "delivery_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "delivery_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_lga_id_fkey"
            columns: ["lga_id"]
            isOneToOne: false
            referencedRelation: "delivery_lgas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_location_node_id_fkey"
            columns: ["location_node_id"]
            isOneToOne: false
            referencedRelation: "delivery_location_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          about_section_image_url: string | null
          address: string | null
          announcement_enabled: boolean
          announcement_link: string | null
          announcement_text: string | null
          bank_transfer_details: Json
          brand_accent_color: string | null
          brand_primary_color: string | null
          brand_secondary_color: string | null
          business_description: string | null
          business_name: string
          business_subtitle: string | null
          city: string | null
          country: string | null
          created_at: string
          currency: string
          custom_orders_hero_image_url: string | null
          delivery_enabled: boolean
          delivery_fee: number
          delivery_information: string | null
          email: string | null
          estimated_delivery_days: number | null
          estimated_preparation_days: number | null
          favicon_url: string | null
          founder_hero_image_url: string | null
          founder_portrait_image_url: string | null
          founder_story_image_url: string | null
          free_delivery_enabled: boolean
          free_delivery_threshold: number | null
          gallery_hero_image_url: string | null
          home_founder_image_url: string | null
          home_hero_image_url: string | null
          id: number
          logo_url: string | null
          minimum_order_amount: number
          opening_hours: Json
          owner_name: string | null
          phone: string | null
          pickup_enabled: boolean
          pickup_information: string | null
          privacy_url: string | null
          services_hero_image_url: string | null
          shop_hero_image_url: string | null
          social_links: Json
          state: string | null
          tagline: string | null
          terms_url: string | null
          timezone: string
          updated_at: string
          updated_by: string | null
          whatsapp_number: string | null
        }
        Insert: {
          about_section_image_url?: string | null
          address?: string | null
          announcement_enabled?: boolean
          announcement_link?: string | null
          announcement_text?: string | null
          bank_transfer_details?: Json
          brand_accent_color?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          business_description?: string | null
          business_name?: string
          business_subtitle?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          custom_orders_hero_image_url?: string | null
          delivery_enabled?: boolean
          delivery_fee?: number
          delivery_information?: string | null
          email?: string | null
          estimated_delivery_days?: number | null
          estimated_preparation_days?: number | null
          favicon_url?: string | null
          founder_hero_image_url?: string | null
          founder_portrait_image_url?: string | null
          founder_story_image_url?: string | null
          free_delivery_enabled?: boolean
          free_delivery_threshold?: number | null
          gallery_hero_image_url?: string | null
          home_founder_image_url?: string | null
          home_hero_image_url?: string | null
          id?: number
          logo_url?: string | null
          minimum_order_amount?: number
          opening_hours?: Json
          owner_name?: string | null
          phone?: string | null
          pickup_enabled?: boolean
          pickup_information?: string | null
          privacy_url?: string | null
          services_hero_image_url?: string | null
          shop_hero_image_url?: string | null
          social_links?: Json
          state?: string | null
          tagline?: string | null
          terms_url?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          about_section_image_url?: string | null
          address?: string | null
          announcement_enabled?: boolean
          announcement_link?: string | null
          announcement_text?: string | null
          bank_transfer_details?: Json
          brand_accent_color?: string | null
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          business_description?: string | null
          business_name?: string
          business_subtitle?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          custom_orders_hero_image_url?: string | null
          delivery_enabled?: boolean
          delivery_fee?: number
          delivery_information?: string | null
          email?: string | null
          estimated_delivery_days?: number | null
          estimated_preparation_days?: number | null
          favicon_url?: string | null
          founder_hero_image_url?: string | null
          founder_portrait_image_url?: string | null
          founder_story_image_url?: string | null
          free_delivery_enabled?: boolean
          free_delivery_threshold?: number | null
          gallery_hero_image_url?: string | null
          home_founder_image_url?: string | null
          home_hero_image_url?: string | null
          id?: number
          logo_url?: string | null
          minimum_order_amount?: number
          opening_hours?: Json
          owner_name?: string | null
          phone?: string | null
          pickup_enabled?: boolean
          pickup_information?: string | null
          privacy_url?: string | null
          services_hero_image_url?: string | null
          shop_hero_image_url?: string | null
          social_links?: Json
          state?: string | null
          tagline?: string | null
          terms_url?: string | null
          timezone?: string
          updated_at?: string
          updated_by?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          custom_text: string | null
          customer_notes: string | null
          id: string
          product_id: string
          quantity: number
          reference_image_url: string | null
          selected_options: Json
          updated_at: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          custom_text?: string | null
          customer_notes?: string | null
          id?: string
          product_id: string
          quantity?: number
          reference_image_url?: string | null
          selected_options?: Json
          updated_at?: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          custom_text?: string | null
          customer_notes?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reference_image_url?: string | null
          selected_options?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_idempotency: {
        Row: {
          created_at: string
          failure_message: string | null
          id: string
          idempotency_key: string
          order_id: string | null
          request_hash: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failure_message?: string | null
          id?: string
          idempotency_key: string
          order_id?: string | null
          request_hash: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failure_message?: string | null
          id?: string
          idempotency_key?: string
          order_id?: string | null
          request_hash?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_idempotency_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_idempotency_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_areas: {
        Row: {
          city_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_areas_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "delivery_cities"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_cities: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          lga_id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          lga_id: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          lga_id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_cities_lga_id_fkey"
            columns: ["lga_id"]
            isOneToOne: false
            referencedRelation: "delivery_lgas"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_lgas: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          state_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          state_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          state_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_lgas_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "delivery_states"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_location_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          is_active: boolean
          location_node_id: string
          normalized_alias: string | null
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          is_active?: boolean
          location_node_id: string
          normalized_alias?: string | null
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          is_active?: boolean
          location_node_id?: string
          normalized_alias?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_location_aliases_location_node_id_fkey"
            columns: ["location_node_id"]
            isOneToOne: false
            referencedRelation: "delivery_location_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_location_nodes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          place_type: string
          settlement_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          place_type?: string
          settlement_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          place_type?: string
          settlement_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_location_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "delivery_location_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_location_nodes_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "delivery_cities"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_states: {
        Row: {
          code: string | null
          country_code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      delivery_zone_aliases: {
        Row: {
          alias: string
          created_at: string
          delivery_zone_id: string
          id: string
          is_active: boolean
          normalized_alias: string | null
        }
        Insert: {
          alias: string
          created_at?: string
          delivery_zone_id: string
          id?: string
          is_active?: boolean
          normalized_alias?: string | null
        }
        Update: {
          alias?: string
          created_at?: string
          delivery_zone_id?: string
          id?: string
          is_active?: boolean
          normalized_alias?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zone_aliases_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          area: string | null
          area_id: string | null
          city: string
          city_id: string | null
          created_at: string
          delivery_fee: number
          id: string
          is_active: boolean
          lga_id: string | null
          location_node_id: string | null
          state: string
          state_id: string | null
          updated_at: string
        }
        Insert: {
          area?: string | null
          area_id?: string | null
          city: string
          city_id?: string | null
          created_at?: string
          delivery_fee?: number
          id?: string
          is_active?: boolean
          lga_id?: string | null
          location_node_id?: string | null
          state: string
          state_id?: string | null
          updated_at?: string
        }
        Update: {
          area?: string | null
          area_id?: string | null
          city?: string
          city_id?: string | null
          created_at?: string
          delivery_fee?: number
          id?: string
          is_active?: boolean
          lga_id?: string | null
          location_node_id?: string | null
          state?: string
          state_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "delivery_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_zones_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "delivery_cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_zones_lga_id_fkey"
            columns: ["lga_id"]
            isOneToOne: false
            referencedRelation: "delivery_lgas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_zones_location_node_id_fkey"
            columns: ["location_node_id"]
            isOneToOne: false
            referencedRelation: "delivery_location_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_zones_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "delivery_states"
            referencedColumns: ["id"]
          },
        ]
      }
      favourites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favourites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_audit_logs: {
        Row: {
          actor_role: string | null
          changed_by: string | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          operation: string
          record_id: string
          record_type: string
        }
        Insert: {
          actor_role?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          record_id: string
          record_type: string
        }
        Update: {
          actor_role?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          record_id?: string
          record_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_audit_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_images: {
        Row: {
          alt_text: string | null
          category: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string
          is_featured: boolean
          is_published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url: string
          is_featured?: boolean
          is_published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string
          is_featured?: boolean
          is_published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          related_order_id: string | null
          related_service_request_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          related_order_id?: string | null
          related_service_request_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          related_order_id?: string | null
          related_service_request_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_service_request_id_fkey"
            columns: ["related_service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_customizations: {
        Row: {
          created_at: string
          id: string
          option_name: string
          option_value: string
          order_item_id: string
          price_adjustment: number
          price_adjustment_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_name: string
          option_value: string
          order_item_id: string
          price_adjustment?: number
          price_adjustment_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          option_name?: string
          option_value?: string
          order_item_id?: string
          price_adjustment?: number
          price_adjustment_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_customizations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          currency: string
          custom_text: string | null
          customer_notes: string | null
          id: string
          item_type: string
          line_total: number
          order_id: string
          product_description: string | null
          product_id: string | null
          product_image_url: string | null
          product_name: string
          product_sku: string | null
          quantity: number
          reference_image_url: string | null
          selected_options: Json
          service_id: string | null
          service_quote_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          currency?: string
          custom_text?: string | null
          customer_notes?: string | null
          id?: string
          item_type?: string
          line_total: number
          order_id: string
          product_description?: string | null
          product_id?: string | null
          product_image_url?: string | null
          product_name: string
          product_sku?: string | null
          quantity: number
          reference_image_url?: string | null
          selected_options?: Json
          service_id?: string | null
          service_quote_id?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          currency?: string
          custom_text?: string | null
          customer_notes?: string | null
          id?: string
          item_type?: string
          line_total?: number
          order_id?: string
          product_description?: string | null
          product_id?: string | null
          product_image_url?: string | null
          product_name?: string
          product_sku?: string | null
          quantity?: number
          reference_image_url?: string | null
          selected_options?: Json
          service_id?: string | null
          service_quote_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_service_quote_id_fkey"
            columns: ["service_quote_id"]
            isOneToOne: false
            referencedRelation: "service_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          change_note: string | null
          change_source: string
          changed_by: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["order_status"]
          old_status: Database["public"]["Enums"]["order_status"] | null
          order_id: string
        }
        Insert: {
          change_note?: string | null
          change_source?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["order_status"]
          old_status?: Database["public"]["Enums"]["order_status"] | null
          order_id: string
        }
        Update: {
          change_note?: string | null
          change_source?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["order_status"]
          old_status?: Database["public"]["Enums"]["order_status"] | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancellation_reason: string | null
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_notes: string | null
          customer_phone: string
          delivery_address: Json | null
          delivery_completed_at: string | null
          delivery_completed_by: string | null
          delivery_fee: number
          delivery_fee_collection_method: string
          delivery_fee_confirmed_at: string | null
          delivery_fee_confirmed_by: string | null
          delivery_fee_settled_at: string | null
          delivery_fee_settled_by: string | null
          delivery_fee_status: string
          delivery_location_review_note: string | null
          delivery_location_review_required: boolean
          delivery_zone_id: string | null
          delivery_zone_matched_by: string | null
          discount_amount: number
          fulfillment_method: Database["public"]["Enums"]["fulfillment_method"]
          id: string
          initial_online_amount: number | null
          order_number: string
          requested_date: string | null
          requested_time: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          created_at?: string
          currency?: string
          customer_email: string
          customer_name: string
          customer_notes?: string | null
          customer_phone: string
          delivery_address?: Json | null
          delivery_completed_at?: string | null
          delivery_completed_by?: string | null
          delivery_fee?: number
          delivery_fee_collection_method?: string
          delivery_fee_confirmed_at?: string | null
          delivery_fee_confirmed_by?: string | null
          delivery_fee_settled_at?: string | null
          delivery_fee_settled_by?: string | null
          delivery_fee_status?: string
          delivery_location_review_note?: string | null
          delivery_location_review_required?: boolean
          delivery_zone_id?: string | null
          delivery_zone_matched_by?: string | null
          discount_amount?: number
          fulfillment_method: Database["public"]["Enums"]["fulfillment_method"]
          id?: string
          initial_online_amount?: number | null
          order_number?: string
          requested_date?: string | null
          requested_time?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cancellation_reason?: string | null
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_notes?: string | null
          customer_phone?: string
          delivery_address?: Json | null
          delivery_completed_at?: string | null
          delivery_completed_by?: string | null
          delivery_fee?: number
          delivery_fee_collection_method?: string
          delivery_fee_confirmed_at?: string | null
          delivery_fee_confirmed_by?: string | null
          delivery_fee_settled_at?: string | null
          delivery_fee_settled_by?: string | null
          delivery_fee_status?: string
          delivery_location_review_note?: string | null
          delivery_location_review_required?: boolean
          delivery_zone_id?: string | null
          delivery_zone_matched_by?: string | null
          discount_amount?: number
          fulfillment_method?: Database["public"]["Enums"]["fulfillment_method"]
          id?: string
          initial_online_amount?: number | null
          order_number?: string
          requested_date?: string | null
          requested_time?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_delivery_completed_by_fkey"
            columns: ["delivery_completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_fee_confirmed_by_fkey"
            columns: ["delivery_fee_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_fee_settled_by_fkey"
            columns: ["delivery_fee_settled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          event_key: string
          event_type: string
          id: string
          last_error: string | null
          payload_summary: Json
          payment_reference: string | null
          processed_at: string | null
          processing_status: string
          provider: string
          received_at: string
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          event_key: string
          event_type: string
          id?: string
          last_error?: string | null
          payload_summary?: Json
          payment_reference?: string | null
          processed_at?: string | null
          processing_status?: string
          provider?: string
          received_at?: string
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          event_key?: string
          event_type?: string
          id?: string
          last_error?: string | null
          payload_summary?: Json
          payment_reference?: string | null
          processed_at?: string | null
          processing_status?: string
          provider?: string
          received_at?: string
          transaction_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          auto_confirmed_by_order: boolean
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          order_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          paystack_access_code: string | null
          paystack_reference: string | null
          provider_response: Json | null
          receipt_url: string | null
          reversal_reason: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transfer_reference: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          auto_confirmed_by_order?: boolean
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          order_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          paystack_access_code?: string | null
          paystack_reference?: string | null
          provider_response?: Json | null
          receipt_url?: string | null
          reversal_reason?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transfer_reference?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          auto_confirmed_by_order?: boolean
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          order_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          paystack_access_code?: string | null
          paystack_reference?: string | null
          provider_response?: Json | null
          receipt_url?: string | null
          reversal_reason?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transfer_reference?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_primary: boolean
          product_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_primary?: boolean
          product_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_primary?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_values: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_available: boolean
          label: string
          option_id: string
          price_adjustment: number
          price_adjustment_type: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_available?: boolean
          label: string
          option_id: string
          price_adjustment?: number
          price_adjustment_type?: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_available?: boolean
          label?: string
          option_id?: string
          price_adjustment?: number
          price_adjustment_type?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          display_order: number
          display_style: string
          help_text: string | null
          id: string
          input_type: string
          is_active: boolean
          is_required: boolean
          maximum_selections: number | null
          minimum_selections: number
          name: string
          placeholder: string | null
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          display_order?: number
          display_style?: string
          help_text?: string | null
          id?: string
          input_type?: string
          is_active?: boolean
          is_required?: boolean
          maximum_selections?: number | null
          minimum_selections?: number
          name: string
          placeholder?: string | null
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          display_order?: number
          display_style?: string
          help_text?: string | null
          id?: string
          input_type?: string
          is_active?: boolean
          is_required?: boolean
          maximum_selections?: number | null
          minimum_selections?: number
          name?: string
          placeholder?: string | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          availability: Database["public"]["Enums"]["product_availability"]
          category_id: string | null
          compare_at_price: number | null
          created_at: string
          currency: string
          description: string | null
          display_order: number
          id: string
          is_customizable: boolean
          is_featured: boolean
          maximum_order_quantity: number | null
          meta_description: string | null
          meta_title: string | null
          minimum_order_quantity: number
          name: string
          preparation_time_days: number | null
          price: number
          pricing_type: Database["public"]["Enums"]["product_pricing_type"]
          short_description: string | null
          sku: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          availability?: Database["public"]["Enums"]["product_availability"]
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          id?: string
          is_customizable?: boolean
          is_featured?: boolean
          maximum_order_quantity?: number | null
          meta_description?: string | null
          meta_title?: string | null
          minimum_order_quantity?: number
          name: string
          preparation_time_days?: number | null
          price?: number
          pricing_type?: Database["public"]["Enums"]["product_pricing_type"]
          short_description?: string | null
          sku?: string | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          availability?: Database["public"]["Enums"]["product_availability"]
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          id?: string
          is_customizable?: boolean
          is_featured?: boolean
          maximum_order_quantity?: number | null
          meta_description?: string | null
          meta_title?: string | null
          minimum_order_quantity?: number
          name?: string
          preparation_time_days?: number | null
          price?: number
          pricing_type?: Database["public"]["Enums"]["product_pricing_type"]
          short_description?: string | null
          sku?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      push_notification_dispatches: {
        Row: {
          attempt_count: number
          completed_at: string | null
          device_count: number
          failed_count: number
          last_attempt_at: string | null
          last_error: string | null
          next_attempt_at: string | null
          notification_id: string
          sent_count: number
          started_at: string
          status: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          device_count?: number
          failed_count?: number
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          notification_id: string
          sent_count?: number
          started_at?: string
          status?: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          device_count?: number
          failed_count?: number
          last_attempt_at?: string | null
          last_error?: string | null
          next_attempt_at?: string | null
          notification_id?: string
          sent_count?: number
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_dispatches_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: true
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          device_label: string | null
          id: string
          is_active: boolean
          last_seen_at: string
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          admin_response: string | null
          comment: string | null
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          rating: number
          responded_at: string | null
          status: Database["public"]["Enums"]["review_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          rating: number
          responded_at?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          rating?: number
          responded_at?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_quotes: {
        Row: {
          accepted_at: string | null
          amount: number
          converted_at: string | null
          converted_order_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_message: string | null
          description: string | null
          id: string
          quote_number: string
          rejected_at: string | null
          request_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          terms_and_conditions: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          amount: number
          converted_at?: string | null
          converted_order_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_message?: string | null
          description?: string | null
          id?: string
          quote_number?: string
          rejected_at?: string | null
          request_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          terms_and_conditions?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          amount?: number
          converted_at?: string | null
          converted_order_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_message?: string | null
          description?: string | null
          id?: string
          quote_number?: string
          rejected_at?: string | null
          request_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          terms_and_conditions?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_quotes_converted_order_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_quotes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          additional_notes: string | null
          budget_max: number | null
          budget_min: number | null
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string
          event_date: string | null
          event_location: string | null
          event_time: string | null
          event_type: string | null
          guest_count: number | null
          id: string
          internal_notes: string | null
          reference_images: Json
          request_number: string
          requirements: string
          reviewed_at: string | null
          service_id: string
          status: Database["public"]["Enums"]["service_request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_notes?: string | null
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          currency?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          event_date?: string | null
          event_location?: string | null
          event_time?: string | null
          event_type?: string | null
          guest_count?: number | null
          id?: string
          internal_notes?: string | null
          reference_images?: Json
          request_number?: string
          requirements: string
          reviewed_at?: string | null
          service_id: string
          status?: Database["public"]["Enums"]["service_request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_notes?: string | null
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          event_date?: string | null
          event_location?: string | null
          event_time?: string | null
          event_type?: string | null
          guest_count?: number | null
          id?: string
          internal_notes?: string | null
          reference_images?: Json
          request_number?: string
          requirements?: string
          reviewed_at?: string | null
          service_id?: string
          status?: Database["public"]["Enums"]["service_request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          preparation_time_days: number | null
          price: number
          pricing_type: Database["public"]["Enums"]["product_pricing_type"]
          short_description: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          preparation_time_days?: number | null
          price?: number
          pricing_type?: Database["public"]["Enums"]["product_pricing_type"]
          short_description?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          preparation_time_days?: number | null
          price?: number
          pricing_type?: Database["public"]["Enums"]["product_pricing_type"]
          short_description?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_confirm_manual_delivery_fee: {
        Args: { p_delivery_fee: number; p_note?: string; p_order_id: string }
        Returns: Json
      }
      admin_get_push_dispatch_monitor: { Args: never; Returns: Json }
      admin_mark_delivery_completed: {
        Args: { p_order_id: string }
        Returns: Json
      }
      admin_mark_delivery_fee_settled: {
        Args: { p_note?: string; p_order_id: string }
        Returns: Json
      }
      admin_reopen_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: Json
      }
      admin_review_bank_transfer: {
        Args: { p_approve: boolean; p_payment_id: string; p_reason?: string }
        Returns: Json
      }
      admin_send_broadcast_notification: {
        Args: {
          p_action_url?: string
          p_message: string
          p_title: string
          p_type?: Database["public"]["Enums"]["notification_type"]
        }
        Returns: number
      }
      admin_send_notification: {
        Args: {
          p_action_url?: string
          p_message: string
          p_title: string
          p_type?: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: string
      }
      admin_send_notification_idempotent: {
        Args: {
          p_action_url: string
          p_message: string
          p_request_id: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: Json
      }
      checkout_create_order: {
        Args: {
          p_customer_notes?: string
          p_delivery_address?: Json
          p_fulfillment_method: Database["public"]["Enums"]["fulfillment_method"]
          p_receipt_path?: string
          p_requested_date?: string
          p_requested_time?: string
          p_transfer_reference?: string
        }
        Returns: Json
      }
      claim_notification_push_dispatch: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      complete_notification_push_dispatch: {
        Args: {
          p_devices: number
          p_failed: number
          p_notification_id: string
          p_sent: number
        }
        Returns: undefined
      }
      create_notification: {
        Args: {
          p_action_url?: string
          p_message: string
          p_order_id?: string
          p_service_request_id?: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: string
      }
      enqueue_due_notification_push_retries: { Args: never; Returns: number }
      get_delivery_fee:
        | {
            Args: { p_area?: string; p_city: string; p_state: string }
            Returns: Json
          }
        | {
            Args: {
              p_area_id?: string
              p_city_id: string
              p_is_custom_location?: boolean
              p_lga_id: string
              p_location_node_id?: string
              p_state_id: string
            }
            Returns: Json
          }
      is_admin: { Args: never; Returns: boolean }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_push_dispatch_partial: {
        Args: {
          p_devices: number
          p_error: string
          p_failed: number
          p_notification_id: string
          p_sent: number
        }
        Returns: undefined
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      normalize_notification_action_url: {
        Args: { p_action_url: string }
        Returns: string
      }
      schedule_notification_push_retry: {
        Args: {
          p_devices: number
          p_error: string
          p_failed: number
          p_notification_id: string
          p_sent: number
        }
        Returns: Json
      }
      verify_hafhass_push_webhook: {
        Args: { p_secret: string }
        Returns: boolean
      }
    }
    Enums: {
      fulfillment_method: "pickup" | "delivery"
      notification_type:
        | "welcome"
        | "order_confirmation"
        | "payment_confirmation"
        | "order_update"
        | "delivery_update"
        | "service_update"
        | "promotion"
        | "general"
      order_status:
        | "pending"
        | "awaiting_payment"
        | "payment_confirmed"
        | "processing"
        | "ready_for_pickup"
        | "out_for_delivery"
        | "completed"
        | "cancelled"
      payment_method: "paystack" | "bank_transfer"
      payment_status:
        | "pending"
        | "processing"
        | "successful"
        | "failed"
        | "refunded"
        | "partially_refunded"
      product_availability:
        | "in_stock"
        | "out_of_stock"
        | "pre_order"
        | "made_to_order"
      product_pricing_type: "fixed" | "starting_from" | "quote"
      product_status: "draft" | "active" | "archived"
      quote_status: "draft" | "sent" | "accepted" | "rejected" | "expired"
      review_status: "pending" | "approved" | "rejected"
      service_request_status:
        | "pending"
        | "reviewing"
        | "quoted"
        | "accepted"
        | "declined"
        | "in_progress"
        | "completed"
        | "cancelled"
      user_role: "customer" | "admin" | "staff"
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
      fulfillment_method: ["pickup", "delivery"],
      notification_type: [
        "welcome",
        "order_confirmation",
        "payment_confirmation",
        "order_update",
        "delivery_update",
        "service_update",
        "promotion",
        "general",
      ],
      order_status: [
        "pending",
        "awaiting_payment",
        "payment_confirmed",
        "processing",
        "ready_for_pickup",
        "out_for_delivery",
        "completed",
        "cancelled",
      ],
      payment_method: ["paystack", "bank_transfer"],
      payment_status: [
        "pending",
        "processing",
        "successful",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      product_availability: [
        "in_stock",
        "out_of_stock",
        "pre_order",
        "made_to_order",
      ],
      product_pricing_type: ["fixed", "starting_from", "quote"],
      product_status: ["draft", "active", "archived"],
      quote_status: ["draft", "sent", "accepted", "rejected", "expired"],
      review_status: ["pending", "approved", "rejected"],
      service_request_status: [
        "pending",
        "reviewing",
        "quoted",
        "accepted",
        "declined",
        "in_progress",
        "completed",
        "cancelled",
      ],
      user_role: ["customer", "admin", "staff"],
    },
  },
} as const
