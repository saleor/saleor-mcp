import type { AppPermission } from "@saleor/app-sdk/types";

export type PermissionOption = {
  code: AppPermission;
  label: string;
  group: "Store operations" | "Promotions" | "Delivery and taxes" | "Content";
};

export const permissionOptions: readonly PermissionOption[] = [
  {
    code: "MANAGE_PRODUCTS",
    label: "Products",
    group: "Store operations",
  },
  {
    code: "MANAGE_PRODUCT_TYPES_AND_ATTRIBUTES",
    label: "Product types and attributes",
    group: "Store operations",
  },
  {
    code: "MANAGE_ORDERS",
    label: "Orders",
    group: "Store operations",
  },
  {
    code: "MANAGE_ORDERS_IMPORT",
    label: "Order imports",
    group: "Store operations",
  },
  {
    code: "MANAGE_CHECKOUTS",
    label: "Checkouts",
    group: "Store operations",
  },
  {
    code: "HANDLE_CHECKOUTS",
    label: "Checkout processing",
    group: "Store operations",
  },
  {
    code: "HANDLE_PAYMENTS",
    label: "Payments",
    group: "Store operations",
  },
  {
    code: "MANAGE_DISCOUNTS",
    label: "Discounts",
    group: "Promotions",
  },
  {
    code: "MANAGE_GIFT_CARD",
    label: "Gift cards",
    group: "Promotions",
  },
  {
    code: "MANAGE_SHIPPING",
    label: "Shipping",
    group: "Delivery and taxes",
  },
  {
    code: "MANAGE_TAXES",
    label: "Taxes",
    group: "Delivery and taxes",
  },
  {
    code: "HANDLE_TAXES",
    label: "Tax calculations",
    group: "Delivery and taxes",
  },
  {
    code: "MANAGE_MENUS",
    label: "Menus",
    group: "Content",
  },
  {
    code: "MANAGE_PAGES",
    label: "Pages",
    group: "Content",
  },
  {
    code: "MANAGE_PAGE_TYPES_AND_ATTRIBUTES",
    label: "Page types and attributes",
    group: "Content",
  },
  {
    code: "MANAGE_TRANSLATIONS",
    label: "Translations",
    group: "Content",
  },
];
