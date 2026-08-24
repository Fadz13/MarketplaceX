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
      activity_logs: {
        Row: {
          activity: Database["public"]["Enums"]["activity_type"]
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          new_data: Json | null
          old_data: Json | null
          session_id: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          activity: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          activity?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs_2026_07: {
        Row: {
          activity: Database["public"]["Enums"]["activity_type"]
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          new_data: Json | null
          old_data: Json | null
          session_id: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          activity: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          activity?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      activity_logs_2026_08: {
        Row: {
          activity: Database["public"]["Enums"]["activity_type"]
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          new_data: Json | null
          old_data: Json | null
          session_id: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          activity: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          activity?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      activity_logs_2026_09: {
        Row: {
          activity: Database["public"]["Enums"]["activity_type"]
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          new_data: Json | null
          old_data: Json | null
          session_id: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          activity: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          activity?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      activity_logs_default: {
        Row: {
          activity: Database["public"]["Enums"]["activity_type"]
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          new_data: Json | null
          old_data: Json | null
          session_id: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          activity: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          activity?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          new_data?: Json | null
          old_data?: Json | null
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      addresses: {
        Row: {
          address_detail: string
          city: string
          created_at: string
          district: string
          id: string
          is_default: boolean
          label: string
          latitude: number | null
          longitude: number | null
          phone: string
          postal_code: string
          province: string
          recipient_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_detail: string
          city: string
          created_at?: string
          district: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          phone: string
          postal_code: string
          province: string
          recipient_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_detail?: string
          city?: string
          created_at?: string
          district?: string
          id?: string
          is_default?: boolean
          label?: string
          latitude?: number | null
          longitude?: number | null
          phone?: string
          postal_code?: string
          province?: string
          recipient_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          image_url: string
          link_target: string
          link_url: string | null
          mobile_image_url: string | null
          sort_order: number
          starts_at: string | null
          status: Database["public"]["Enums"]["banner_status"]
          subtitle: string | null
          target_page: string | null
          title: string
          type: Database["public"]["Enums"]["banner_type"]
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          image_url: string
          link_target?: string
          link_url?: string | null
          mobile_image_url?: string | null
          sort_order?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["banner_status"]
          subtitle?: string | null
          target_page?: string | null
          title: string
          type?: Database["public"]["Enums"]["banner_type"]
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string
          link_target?: string
          link_url?: string | null
          mobile_image_url?: string | null
          sort_order?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["banner_status"]
          subtitle?: string | null
          target_page?: string | null
          title?: string
          type?: Database["public"]["Enums"]["banner_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banners_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "banners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_verified: boolean
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          product_sku_id: string | null
          quantity: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          product_sku_id?: string | null
          quantity?: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          product_sku_id?: string | null
          quantity?: number
          unit_price?: number
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
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_sku_id_fkey"
            columns: ["product_sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          depth: number
          description: string | null
          icon_url: string | null
          id: string
          image_url: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["category_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          depth?: number
          description?: string | null
          icon_url?: string | null
          id?: string
          image_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["category_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          depth?: number
          description?: string | null
          icon_url?: string | null
          id?: string
          image_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["category_status"]
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
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["category_id"]
          },
        ]
      }
      conversations: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          last_message_at: string | null
          seller_id: string
          store_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          seller_id: string
          store_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          seller_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_seller_revenue"
            referencedColumns: ["store_id"]
          },
        ]
      }
      flash_sale_items: {
        Row: {
          created_at: string
          flash_sale_id: string
          id: string
          is_active: boolean
          original_price: number
          product_id: string
          product_sku_id: string | null
          quota: number
          sale_price: number
          sold_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          flash_sale_id: string
          id?: string
          is_active?: boolean
          original_price: number
          product_id: string
          product_sku_id?: string | null
          quota: number
          sale_price: number
          sold_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          flash_sale_id?: string
          id?: string
          is_active?: boolean
          original_price?: number
          product_id?: string
          product_sku_id?: string | null
          quota?: number
          sale_price?: number
          sold_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_sale_items_flash_sale_id_fkey"
            columns: ["flash_sale_id"]
            isOneToOne: false
            referencedRelation: "flash_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_sale_items_product_sku_id_fkey"
            columns: ["product_sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_sales: {
        Row: {
          banner_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          slug: string
          starts_at: string
          status: Database["public"]["Enums"]["flash_sale_status"]
          title: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          slug: string
          starts_at: string
          status?: Database["public"]["Enums"]["flash_sale_status"]
          title: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          slug?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["flash_sale_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_url: string | null
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          reference_id: string | null
          reference_type: string | null
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
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_image_url: string | null
          product_name: string
          product_sku_id: string | null
          quantity: number
          seller_id: string
          sku_code: string | null
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          unit_price: number
          updated_at: string
          variant_label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_image_url?: string | null
          product_name: string
          product_sku_id?: string | null
          quantity: number
          seller_id: string
          sku_code?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          unit_price: number
          updated_at?: string
          variant_label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_image_url?: string | null
          product_name?: string
          product_sku_id?: string | null
          quantity?: number
          seller_id?: string
          sku_code?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          unit_price?: number
          updated_at?: string
          variant_label?: string | null
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
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_summary"
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
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_sku_id_fkey"
            columns: ["product_sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "order_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_seller_revenue"
            referencedColumns: ["store_id"]
          },
        ]
      }
      orders: {
        Row: {
          address_id: string | null
          buyer_id: string
          buyer_notes: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          completed_at: string | null
          created_at: string
          discount_amount: number
          id: string
          order_number: string
          payment_due_at: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          platform_fee: number
          shipping_cost: number
          shipping_snapshot: Json
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at: string
          voucher_id: string | null
        }
        Insert: {
          address_id?: string | null
          buyer_id: string
          buyer_notes?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          discount_amount?: number
          id?: string
          order_number: string
          payment_due_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_fee?: number
          shipping_cost?: number
          shipping_snapshot?: Json
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total_amount: number
          updated_at?: string
          voucher_id?: string | null
        }
        Update: {
          address_id?: string | null
          buyer_id?: string
          buyer_notes?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          discount_amount?: number
          id?: string
          order_number?: string
          payment_due_at?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_fee?: number
          shipping_cost?: number
          shipping_snapshot?: Json
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total_amount?: number
          updated_at?: string
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_logs: {
        Row: {
          created_at: string
          event: Database["public"]["Enums"]["payment_log_event"]
          id: string
          note: string | null
          payload: Json
          payment_id: string
        }
        Insert: {
          created_at?: string
          event: Database["public"]["Enums"]["payment_log_event"]
          id?: string
          note?: string | null
          payload?: Json
          payment_id: string
        }
        Update: {
          created_at?: string
          event?: Database["public"]["Enums"]["payment_log_event"]
          id?: string
          note?: string | null
          payload?: Json
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          expired_at: string | null
          fee_amount: number
          gateway_response: Json | null
          id: string
          net_amount: number | null
          order_id: string
          paid_at: string | null
          payment_channel: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          refunded_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          expired_at?: string | null
          fee_amount?: number
          gateway_response?: Json | null
          id?: string
          net_amount?: number | null
          order_id: string
          paid_at?: string | null
          payment_channel?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          expired_at?: string | null
          fee_amount?: number
          gateway_response?: Json | null
          id?: string
          net_amount?: number | null
          order_id?: string
          paid_at?: string | null
          payment_channel?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_id?: string | null
          updated_at?: string
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
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          label: string
          name: string
          resource: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          label: string
          name: string
          resource: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          name?: string
          resource?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          image_url: string
          is_primary: boolean
          product_id: string
          sort_order: number
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_skus: {
        Row: {
          created_at: string
          discount_price: number | null
          id: string
          image_url: string | null
          is_active: boolean
          price: number
          product_id: string
          sku_code: string | null
          stock: number
          updated_at: string
          variant_value_ids: string[]
          weight: number | null
        }
        Insert: {
          created_at?: string
          discount_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          price: number
          product_id: string
          sku_code?: string | null
          stock?: number
          updated_at?: string
          variant_value_ids?: string[]
          weight?: number | null
        }
        Update: {
          created_at?: string
          discount_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          price?: number
          product_id?: string
          sku_code?: string | null
          stock?: number
          updated_at?: string
          variant_value_ids?: string[]
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_skus_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string | null
          category_id: string | null
          condition: Database["public"]["Enums"]["product_condition"]
          created_at: string
          description: string | null
          discount_price: number | null
          has_variants: boolean
          height: number | null
          id: string
          length: number | null
          meta_description: string | null
          meta_title: string | null
          name: string
          price: number
          rating: number
          review_count: number
          slug: string
          sold_count: number
          status: Database["public"]["Enums"]["product_status"]
          stock: number
          store_id: string
          tags: string[] | null
          updated_at: string
          view_count: number
          weight: number | null
          width: number | null
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          condition?: Database["public"]["Enums"]["product_condition"]
          created_at?: string
          description?: string | null
          discount_price?: number | null
          has_variants?: boolean
          height?: number | null
          id?: string
          length?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          price: number
          rating?: number
          review_count?: number
          slug: string
          sold_count?: number
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          store_id: string
          tags?: string[] | null
          updated_at?: string
          view_count?: number
          weight?: number | null
          width?: number | null
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          condition?: Database["public"]["Enums"]["product_condition"]
          created_at?: string
          description?: string | null
          discount_price?: number | null
          has_variants?: boolean
          height?: number | null
          id?: string
          length?: number | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          price?: number
          rating?: number
          review_count?: number
          slug?: string
          sold_count?: number
          status?: Database["public"]["Enums"]["product_status"]
          stock?: number
          store_id?: string
          tags?: string[] | null
          updated_at?: string
          view_count?: number
          weight?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_seller_revenue"
            referencedColumns: ["store_id"]
          },
        ]
      }
      report_categories: {
        Row: {
          applies_to: string[]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          sort_order: number
        }
        Insert: {
          applies_to?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          sort_order?: number
        }
        Update: {
          applies_to?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "report_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          evidence_urls: string[]
          id: string
          reason: string
          report_category_id: string
          reporter_id: string
          resolution_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          evidence_urls?: string[]
          id?: string
          reason: string
          report_category_id: string
          reporter_id: string
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          evidence_urls?: string[]
          id?: string
          reason?: string
          report_category_id?: string
          reporter_id?: string
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_report_category_id_fkey"
            columns: ["report_category_id"]
            isOneToOne: false
            referencedRelation: "report_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      review_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          review_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          review_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          review_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_images_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          helpful_count: number
          id: string
          is_anonymous: boolean
          is_verified_purchase: boolean
          order_item_id: string
          product_id: string
          rating: number
          seller_response: string | null
          seller_response_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          helpful_count?: number
          id?: string
          is_anonymous?: boolean
          is_verified_purchase?: boolean
          order_item_id: string
          product_id: string
          rating: number
          seller_response?: string | null
          seller_response_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          helpful_count?: number
          id?: string
          is_anonymous?: boolean
          is_verified_purchase?: boolean
          order_item_id?: string
          product_id?: string
          rating?: number
          seller_response?: string | null
          seller_response_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
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
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          granted_at: string
          granted_by: string | null
          permission_id: string
          role_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          permission_id: string
          role_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_role_permissions_granted_by"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          label: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          label: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          label?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_analytics: {
        Row: {
          avg_order_value: number
          conversion_rate: number
          created_at: string
          date: string
          id: string
          new_customers: number
          returning_customers: number
          store_id: string
          total_items: number
          total_orders: number
          total_revenue: number
          total_visitors: number
          updated_at: string
        }
        Insert: {
          avg_order_value?: number
          conversion_rate?: number
          created_at?: string
          date: string
          id?: string
          new_customers?: number
          returning_customers?: number
          store_id: string
          total_items?: number
          total_orders?: number
          total_revenue?: number
          total_visitors?: number
          updated_at?: string
        }
        Update: {
          avg_order_value?: number
          conversion_rate?: number
          created_at?: string
          date?: string
          id?: string
          new_customers?: number
          returning_customers?: number
          store_id?: string
          total_items?: number
          total_orders?: number
          total_revenue?: number
          total_visitors?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_analytics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_analytics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "sales_analytics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_seller_revenue"
            referencedColumns: ["store_id"]
          },
        ]
      }
      seller_balance_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          seller_id: string
          transaction_type: Database["public"]["Enums"]["balance_transaction_type"]
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          seller_id: string
          transaction_type: Database["public"]["Enums"]["balance_transaction_type"]
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          seller_id?: string
          transaction_type?: Database["public"]["Enums"]["balance_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "seller_balance_transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_balances: {
        Row: {
          available_balance: number
          created_at: string
          id: string
          pending_balance: number
          seller_id: string
          total_earned: number
          total_withdrawn: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          id?: string
          pending_balance?: number
          seller_id: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          id?: string
          pending_balance?: number
          seller_id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_balances_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_withdrawals: {
        Row: {
          admin_note: string | null
          amount: number
          bank_account_name: string
          bank_account_no: string
          bank_name: string
          completed_at: string | null
          created_at: string
          fee_amount: number
          id: string
          net_amount: number | null
          processed_at: string | null
          processed_by: string | null
          reference_no: string | null
          seller_id: string
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          bank_account_name: string
          bank_account_no: string
          bank_name: string
          completed_at?: string | null
          created_at?: string
          fee_amount?: number
          id?: string
          net_amount?: number | null
          processed_at?: string | null
          processed_by?: string | null
          reference_no?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          bank_account_name?: string
          bank_account_no?: string
          bank_name?: string
          completed_at?: string | null
          created_at?: string
          fee_amount?: number
          id?: string
          net_amount?: number | null
          processed_at?: string | null
          processed_by?: string | null
          reference_no?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_withdrawals_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_withdrawals_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_tracking: {
        Row: {
          created_at: string
          description: string | null
          event_time: string
          id: string
          location: string | null
          raw_payload: Json
          shipment_id: string
          status: Database["public"]["Enums"]["shipping_status"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_time: string
          id?: string
          location?: string | null
          raw_payload?: Json
          shipment_id: string
          status: Database["public"]["Enums"]["shipping_status"]
        }
        Update: {
          created_at?: string
          description?: string | null
          event_time?: string
          id?: string
          location?: string | null
          raw_payload?: Json
          shipment_id?: string
          status?: Database["public"]["Enums"]["shipping_status"]
        }
        Relationships: [
          {
            foreignKeyName: "shipment_tracking_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          courier: string
          created_at: string
          estimated_days: number | null
          id: string
          order_id: string
          origin_address: Json
          received_at: string | null
          service_type: string | null
          shipped_at: string | null
          shipping_cost: number
          shipping_status: Database["public"]["Enums"]["shipping_status"]
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          courier: string
          created_at?: string
          estimated_days?: number | null
          id?: string
          order_id: string
          origin_address?: Json
          received_at?: string | null
          service_type?: string | null
          shipped_at?: string | null
          shipping_cost?: number
          shipping_status?: Database["public"]["Enums"]["shipping_status"]
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          courier?: string
          created_at?: string
          estimated_days?: number | null
          id?: string
          order_id?: string
          origin_address?: Json
          received_at?: string | null
          service_type?: string | null
          shipped_at?: string | null
          shipping_cost?: number
          shipping_status?: Database["public"]["Enums"]["shipping_status"]
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          note: string | null
          product_id: string
          product_sku_id: string | null
          quantity_delta: number
          reference_id: string | null
          reference_type: string | null
          stock_after: number
          stock_before: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          note?: string | null
          product_id: string
          product_sku_id?: string | null
          quantity_delta: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after: number
          stock_before: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          note?: string | null
          product_id?: string
          product_sku_id?: string | null
          quantity_delta?: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after?: number
          stock_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_sku_id_fkey"
            columns: ["product_sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements_2026_07: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          note: string | null
          product_id: string
          product_sku_id: string | null
          quantity_delta: number
          reference_id: string | null
          reference_type: string | null
          stock_after: number
          stock_before: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          note?: string | null
          product_id: string
          product_sku_id?: string | null
          quantity_delta: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after: number
          stock_before: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          note?: string | null
          product_id?: string
          product_sku_id?: string | null
          quantity_delta?: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after?: number
          stock_before?: number
        }
        Relationships: []
      }
      stock_movements_2026_08: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          note: string | null
          product_id: string
          product_sku_id: string | null
          quantity_delta: number
          reference_id: string | null
          reference_type: string | null
          stock_after: number
          stock_before: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          note?: string | null
          product_id: string
          product_sku_id?: string | null
          quantity_delta: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after: number
          stock_before: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          note?: string | null
          product_id?: string
          product_sku_id?: string | null
          quantity_delta?: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after?: number
          stock_before?: number
        }
        Relationships: []
      }
      stock_movements_2026_09: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          note: string | null
          product_id: string
          product_sku_id: string | null
          quantity_delta: number
          reference_id: string | null
          reference_type: string | null
          stock_after: number
          stock_before: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          note?: string | null
          product_id: string
          product_sku_id?: string | null
          quantity_delta: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after: number
          stock_before: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          note?: string | null
          product_id?: string
          product_sku_id?: string | null
          quantity_delta?: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after?: number
          stock_before?: number
        }
        Relationships: []
      }
      stock_movements_default: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          note: string | null
          product_id: string
          product_sku_id: string | null
          quantity_delta: number
          reference_id: string | null
          reference_type: string | null
          stock_after: number
          stock_before: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          note?: string | null
          product_id: string
          product_sku_id?: string | null
          quantity_delta: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after: number
          stock_before: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          note?: string | null
          product_id?: string
          product_sku_id?: string | null
          quantity_delta?: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after?: number
          stock_before?: number
        }
        Relationships: []
      }
      store_followers: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_followers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_followers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_followers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_seller_revenue"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          banner_url: string | null
          city: string | null
          created_at: string
          description: string | null
          follower_count: number
          id: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          meta_description: string | null
          meta_title: string | null
          province: string | null
          rating: number
          review_count: number
          seller_id: string
          slug: string
          status: Database["public"]["Enums"]["store_status"]
          store_name: string
          total_revenue: number
          total_sales: number
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          follower_count?: number
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          province?: string | null
          rating?: number
          review_count?: number
          seller_id: string
          slug: string
          status?: Database["public"]["Enums"]["store_status"]
          store_name: string
          total_revenue?: number
          total_sales?: number
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          follower_count?: number
          id?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          meta_description?: string | null
          meta_title?: string | null
          province?: string | null
          rating?: number
          review_count?: number
          seller_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["store_status"]
          store_name?: string
          total_revenue?: number
          total_sales?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string
          full_name: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          id: string
          phone: string | null
          social_links: Json
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          phone?: string | null
          social_links?: Json
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          full_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          id?: string
          phone?: string | null
          social_links?: Json
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          role_id: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          role_id: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_vouchers: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          used: boolean
          used_at: string | null
          user_id: string
          voucher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          used?: boolean
          used_at?: string | null
          user_id: string
          voucher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          used?: boolean
          used_at?: string | null
          user_id?: string
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_vouchers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_vouchers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vw_order_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_vouchers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_vouchers_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          created_at: string
          email: string
          email_verified: boolean
          id: string
          last_login_at: string | null
          role: string
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          auth_id?: string | null
          created_at?: string
          email: string
          email_verified?: boolean
          id?: string
          last_login_at?: string | null
          role?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          auth_id?: string | null
          created_at?: string
          email?: string
          email_verified?: boolean
          id?: string
          last_login_at?: string | null
          role?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      variant_options: {
        Row: {
          created_at: string
          id: string
          name: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "variant_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_values: {
        Row: {
          color_hex: string | null
          created_at: string
          display_value: string | null
          id: string
          image_url: string | null
          sort_order: number
          value: string
          variant_option_id: string
        }
        Insert: {
          color_hex?: string | null
          created_at?: string
          display_value?: string | null
          id?: string
          image_url?: string | null
          sort_order?: number
          value: string
          variant_option_id: string
        }
        Update: {
          color_hex?: string | null
          created_at?: string
          display_value?: string | null
          id?: string
          image_url?: string | null
          sort_order?: number
          value?: string
          variant_option_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_values_variant_option_id_fkey"
            columns: ["variant_option_id"]
            isOneToOne: false
            referencedRelation: "variant_options"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          max_discount: number | null
          minimum_purchase: number
          quota: number | null
          scope: Database["public"]["Enums"]["voucher_scope"]
          start_date: string
          status: Database["public"]["Enums"]["voucher_status"]
          store_id: string | null
          type: Database["public"]["Enums"]["voucher_type"]
          updated_at: string
          used_count: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          max_discount?: number | null
          minimum_purchase?: number
          quota?: number | null
          scope?: Database["public"]["Enums"]["voucher_scope"]
          start_date: string
          status?: Database["public"]["Enums"]["voucher_status"]
          store_id?: string | null
          type: Database["public"]["Enums"]["voucher_type"]
          updated_at?: string
          used_count?: number
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          max_discount?: number | null
          minimum_purchase?: number
          quota?: number | null
          scope?: Database["public"]["Enums"]["voucher_scope"]
          start_date?: string
          status?: Database["public"]["Enums"]["voucher_status"]
          store_id?: string | null
          type?: Database["public"]["Enums"]["voucher_type"]
          updated_at?: string
          used_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "vouchers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_seller_revenue"
            referencedColumns: ["store_id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          wishlist_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          wishlist_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          wishlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "wishlists"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_active_flash_sale_items: {
        Row: {
          discount_pct: number | null
          flash_sale_ends_at: string | null
          flash_sale_id: string | null
          flash_sale_title: string | null
          id: string | null
          original_price: number | null
          product_id: string | null
          product_image_url: string | null
          product_name: string | null
          product_sku_id: string | null
          product_slug: string | null
          quota: number | null
          remaining_quota: number | null
          sale_price: number | null
          sold_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "flash_sale_items_flash_sale_id_fkey"
            columns: ["flash_sale_id"]
            isOneToOne: false
            referencedRelation: "flash_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_sale_items_product_sku_id_fkey"
            columns: ["product_sku_id"]
            isOneToOne: false
            referencedRelation: "product_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_active_products: {
        Row: {
          brand_id: string | null
          brand_is_verified: boolean | null
          brand_name: string | null
          brand_slug: string | null
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          condition: Database["public"]["Enums"]["product_condition"] | null
          created_at: string | null
          description: string | null
          discount_price: number | null
          has_variants: boolean | null
          id: string | null
          meta_description: string | null
          meta_title: string | null
          min_sku_discount_price: number | null
          min_sku_price: number | null
          name: string | null
          price: number | null
          primary_image_url: string | null
          rating: number | null
          review_count: number | null
          slug: string | null
          sold_count: number | null
          stock: number | null
          store_city: string | null
          store_id: string | null
          store_logo_url: string | null
          store_name: string | null
          store_rating: number | null
          store_slug: string | null
          tags: string[] | null
          view_count: number | null
          weight: number | null
        }
        Relationships: []
      }
      vw_order_summary: {
        Row: {
          buyer_id: string | null
          completed_at: string | null
          created_at: string | null
          discount_amount: number | null
          id: string | null
          item_count: number | null
          order_number: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          platform_fee: number | null
          shipping_cost: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal: number | null
          total_amount: number | null
          total_quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_pending_withdrawals: {
        Row: {
          amount: number | null
          bank_account_name: string | null
          bank_account_no: string | null
          bank_name: string | null
          created_at: string | null
          current_available_balance: number | null
          fee_amount: number | null
          id: string | null
          net_amount: number | null
          seller_email: string | null
          seller_id: string | null
          seller_name: string | null
          status: Database["public"]["Enums"]["withdrawal_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_withdrawals_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_seller_revenue: {
        Row: {
          available_balance: number | null
          pending_balance: number | null
          review_count: number | null
          seller_id: string | null
          store_id: string | null
          store_name: string | null
          store_rating: number | null
          store_status: Database["public"]["Enums"]["store_status"] | null
          total_earned: number | null
          total_revenue: number | null
          total_sales: number | null
          total_withdrawn: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_store_followers: {
        Row: {
          avatar_url: string | null
          followed_at: string | null
          full_name: string | null
          store_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_followers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_followers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_active_products"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_followers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "vw_seller_revenue"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_unread_message_counts: {
        Row: {
          buyer_id: string | null
          buyer_unread: number | null
          conversation_id: string | null
          seller_id: string | null
          seller_unread: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_stock: {
        Args: {
          p_actor_id?: string
          p_note?: string
          p_product_id: string
          p_quantity: number
          p_sku_id?: string
        }
        Returns: number
      }
      calculate_discount_price: {
        Args: { p_price: number; p_voucher_id: string }
        Returns: number
      }
      calculate_monthly_sales: {
        Args: { p_month: number; p_seller_id: string; p_year: number }
        Returns: number
      }
      calculate_order_total: {
        Args: {
          p_discount_amount?: number
          p_platform_fee?: number
          p_shipping_cost?: number
          p_subtotal: number
        }
        Returns: number
      }
      calculate_payment_status: {
        Args: { p_order_id: string }
        Returns: Database["public"]["Enums"]["payment_status"]
      }
      calculate_platform_fee: {
        Args: { p_fee_rate?: number; p_subtotal: number }
        Returns: number
      }
      calculate_product_rating: {
        Args: { p_product_id: string }
        Returns: number
      }
      calculate_product_stock: {
        Args: { p_product_id: string }
        Returns: number
      }
      calculate_seller_balance: {
        Args: { p_seller_id: string }
        Returns: number
      }
      calculate_seller_income: {
        Args: { p_platform_fee_rate?: number; p_subtotal: number }
        Returns: number
      }
      calculate_shipping_cost: {
        Args: {
          p_courier?: string
          p_destination_city: string
          p_origin_city: string
          p_weight_grams: number
        }
        Returns: number
      }
      calculate_total_sales: { Args: { p_seller_id: string }; Returns: number }
      check_product_availability: {
        Args: { p_product_id: string; p_quantity: number; p_sku_id?: string }
        Returns: boolean
      }
      create_seller_withdrawal: {
  Args: {
    p_amount: number
    p_bank_account_name: string
    p_bank_account_no: string
    p_bank_name: string
    p_fee_amount?: number
  }
  Returns: string
}
      create_notification: {
        Args: {
          p_action_url?: string
          p_message: string
          p_reference_id?: string
          p_reference_type?: string
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: string
      }
      current_user_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      fn_activate_flash_sales: { Args: never; Returns: number }
      fn_create_activity_log_partitions: {
        Args: { p_months?: number }
        Returns: undefined
      }
      fn_log_activity: {
  Args: {
    p_activity: Database["public"]["Enums"]["activity_type"]
    p_metadata?: Json | null
    p_new_data?: Json | null
    p_old_data?: Json | null
    p_target_id: string
    p_target_type: string
  }
  Returns: string
}
      fn_create_stock_movement_partitions: {
        Args: { p_months?: number }
        Returns: undefined
      }
      fn_expire_flash_sales: { Args: never; Returns: number }
      fn_expire_payments: { Args: never; Returns: number }
      fn_expire_vouchers: { Args: never; Returns: number }
      fn_generate_order_number: { Args: never; Returns: string }
      fn_recalculate_store_rating: {
        Args: { p_store_id: string }
        Returns: undefined
      }
      generate_invoice_number: { Args: { p_order_id: string }; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_slug: { Args: { p_input: string }; Returns: string }
      generate_uuid_if_null: { Args: { p_id?: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_seller: { Args: never; Returns: boolean }
      release_reserved_stock: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_reference_id?: string
          p_sku_id?: string
        }
        Returns: number
      }
      remove_stock: {
        Args: {
          p_actor_id?: string
          p_movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          p_note?: string
          p_product_id: string
          p_quantity: number
          p_reference_id?: string
          p_reference_type?: string
          p_sku_id?: string
        }
        Returns: number
      }
      reserve_stock: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_reference_id?: string
          p_sku_id?: string
        }
        Returns: number
      }
      rls_is_admin: { Args: never; Returns: boolean }
      rls_is_authenticated: { Args: never; Returns: boolean }
      rls_is_seller: { Args: never; Returns: boolean }
      rls_my_store_ids: { Args: never; Returns: string[] }
      rls_owns_store: { Args: { p_store_id: string }; Returns: boolean }
      rls_user_id: { Args: never; Returns: string }
      rls_user_role: { Args: never; Returns: string }
      search_products: {
        Args: {
          p_brand_id?: string
          p_category_id?: string
          p_condition?: string
          p_limit?: number
          p_max_price?: number
          p_min_price?: number
          p_min_rating?: number
          p_offset?: number
          p_query?: string
          p_sort?: string
        }
        Returns: {
          brand_id: string
          brand_name: string
          category_id: string
          category_name: string
          condition: Database["public"]["Enums"]["product_condition"]
          discount_price: number
          id: string
          name: string
          price: number
          primary_image_url: string
          rating: number
          relevance_score: number
          review_count: number
          slug: string
          sold_count: number
          stock: number
          store_id: string
          store_name: string
          store_slug: string
        }[]
      }
      search_store: {
        Args: {
          p_city?: string
          p_limit?: number
          p_min_rating?: number
          p_offset?: number
          p_query?: string
          p_sort?: string
        }
        Returns: {
          banner_url: string
          city: string
          description: string
          follower_count: number
          id: string
          logo_url: string
          rating: number
          relevance_score: number
          review_count: number
          slug: string
          store_name: string
          total_sales: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      update_product_rating: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      update_seller_statistics: {
        Args: { p_seller_id: string }
        Returns: undefined
      }
      update_store_rating: { Args: { p_store_id: string }; Returns: number }
      update_updated_at: {
        Args: { p_id: string; p_table: string }
        Returns: undefined
      }
      validate_payment: { Args: { p_payment_id: string }; Returns: Json }
    }
    Enums: {
      activity_type:
        | "auth_login"
        | "auth_logout"
        | "auth_register"
        | "auth_password_changed"
        | "auth_password_reset"
        | "user_created"
        | "user_updated"
        | "user_suspended"
        | "user_banned"
        | "user_activated"
        | "store_created"
        | "store_updated"
        | "store_suspended"
        | "store_activated"
        | "product_created"
        | "product_updated"
        | "product_deleted"
        | "product_suspended"
        | "order_created"
        | "order_cancelled"
        | "order_refunded"
        | "order_status_changed"
        | "payment_created"
        | "payment_success"
        | "payment_failed"
        | "payment_refunded"
        | "withdrawal_requested"
        | "withdrawal_approved"
        | "withdrawal_rejected"
        | "withdrawal_completed"
        | "admin_action"
        | "permission_granted"
        | "permission_revoked"
        | "content_moderated"
      balance_transaction_type: "credit" | "debit"
      banner_status: "active" | "inactive" | "scheduled"
      banner_type: "hero" | "category" | "popup" | "sidebar" | "inline"
      category_status: "active" | "inactive"
      flash_sale_status:
        | "draft"
        | "scheduled"
        | "active"
        | "ended"
        | "cancelled"
      gender_type: "male" | "female" | "prefer_not_to_say"
      notification_type:
        | "order_created"
        | "order_paid"
        | "order_shipped"
        | "order_delivered"
        | "order_completed"
        | "order_cancelled"
        | "order_disputed"
        | "payment_success"
        | "payment_failed"
        | "new_message"
        | "new_review"
        | "review_replied"
        | "flash_sale_start"
        | "flash_sale_end"
        | "store_followed"
        | "withdrawal_approved"
        | "withdrawal_rejected"
        | "promo"
        | "system"
      order_status:
        | "pending"
        | "awaiting_payment"
        | "paid"
        | "processing"
        | "shipped"
        | "delivered"
        | "completed"
        | "cancelled"
        | "refunded"
        | "disputed"
      payment_log_event:
        | "created"
        | "pending"
        | "callback_received"
        | "verified"
        | "success"
        | "failed"
        | "expired"
        | "refund_requested"
        | "refunded"
        | "chargeback"
      payment_method:
        | "bank_transfer"
        | "virtual_account"
        | "e_wallet"
        | "credit_card"
        | "debit_card"
        | "cod"
        | "marketplace_credit"
      payment_status:
        | "pending"
        | "success"
        | "failed"
        | "expired"
        | "refunded"
        | "chargeback"
      product_condition: "new" | "used" | "refurbished"
      product_status:
        | "active"
        | "inactive"
        | "draft"
        | "suspended"
        | "out_of_stock"
      report_status: "pending" | "under_review" | "resolved" | "dismissed"
      shipping_status:
        | "pending"
        | "picked_up"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "returned"
        | "failed"
      stock_movement_type:
        | "purchase"
        | "sale"
        | "return"
        | "adjustment"
        | "flash_sale_reserve"
        | "flash_sale_release"
        | "damage"
      store_status: "active" | "inactive" | "suspended" | "pending_review"
      user_status:
        | "active"
        | "inactive"
        | "suspended"
        | "banned"
        | "pending_verification"
      voucher_scope: "platform" | "store" | "product"
      voucher_status: "active" | "inactive" | "expired"
      voucher_type: "percentage" | "fixed_amount" | "free_shipping"
      withdrawal_status:
        | "pending"
        | "approved"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
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
      activity_type: [
        "auth_login",
        "auth_logout",
        "auth_register",
        "auth_password_changed",
        "auth_password_reset",
        "user_created",
        "user_updated",
        "user_suspended",
        "user_banned",
        "user_activated",
        "store_created",
        "store_updated",
        "store_suspended",
        "store_activated",
        "product_created",
        "product_updated",
        "product_deleted",
        "product_suspended",
        "order_created",
        "order_cancelled",
        "order_refunded",
        "order_status_changed",
        "payment_created",
        "payment_success",
        "payment_failed",
        "payment_refunded",
        "withdrawal_requested",
        "withdrawal_approved",
        "withdrawal_rejected",
        "withdrawal_completed",
        "admin_action",
        "permission_granted",
        "permission_revoked",
        "content_moderated",
      ],
      balance_transaction_type: ["credit", "debit"],
      banner_status: ["active", "inactive", "scheduled"],
      banner_type: ["hero", "category", "popup", "sidebar", "inline"],
      category_status: ["active", "inactive"],
      flash_sale_status: ["draft", "scheduled", "active", "ended", "cancelled"],
      gender_type: ["male", "female", "prefer_not_to_say"],
      notification_type: [
        "order_created",
        "order_paid",
        "order_shipped",
        "order_delivered",
        "order_completed",
        "order_cancelled",
        "order_disputed",
        "payment_success",
        "payment_failed",
        "new_message",
        "new_review",
        "review_replied",
        "flash_sale_start",
        "flash_sale_end",
        "store_followed",
        "withdrawal_approved",
        "withdrawal_rejected",
        "promo",
        "system",
      ],
      order_status: [
        "pending",
        "awaiting_payment",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "completed",
        "cancelled",
        "refunded",
        "disputed",
      ],
      payment_log_event: [
        "created",
        "pending",
        "callback_received",
        "verified",
        "success",
        "failed",
        "expired",
        "refund_requested",
        "refunded",
        "chargeback",
      ],
      payment_method: [
        "bank_transfer",
        "virtual_account",
        "e_wallet",
        "credit_card",
        "debit_card",
        "cod",
        "marketplace_credit",
      ],
      payment_status: [
        "pending",
        "success",
        "failed",
        "expired",
        "refunded",
        "chargeback",
      ],
      product_condition: ["new", "used", "refurbished"],
      product_status: [
        "active",
        "inactive",
        "draft",
        "suspended",
        "out_of_stock",
      ],
      report_status: ["pending", "under_review", "resolved", "dismissed"],
      shipping_status: [
        "pending",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "returned",
        "failed",
      ],
      stock_movement_type: [
        "purchase",
        "sale",
        "return",
        "adjustment",
        "flash_sale_reserve",
        "flash_sale_release",
        "damage",
      ],
      store_status: ["active", "inactive", "suspended", "pending_review"],
      user_status: [
        "active",
        "inactive",
        "suspended",
        "banned",
        "pending_verification",
      ],
      voucher_scope: ["platform", "store", "product"],
      voucher_status: ["active", "inactive", "expired"],
      voucher_type: ["percentage", "fixed_amount", "free_shipping"],
      withdrawal_status: [
        "pending",
        "approved",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
    },
  },
} as const
