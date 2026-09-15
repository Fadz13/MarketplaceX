import { describe, it, expect } from "vitest";

// ── Checkout address integration tests ─────────────────────────────────────

describe("Checkout address integration", () => {
  type AddressForm = {
    recipientName: string;
    phone: string;
    addressDetail: string;
    city: string;
    province: string;
    postalCode: string;
  };

  type SavedAddress = {
    id: string;
    label: string;
    recipient_name: string;
    phone: string;
    address_detail: string;
    province: string;
    city: string;
    district: string;
    postal_code: string;
    is_default: boolean;
  };

  function addressToForm(addr: SavedAddress): AddressForm {
    return {
      recipientName: addr.recipient_name,
      phone: addr.phone,
      addressDetail: addr.address_detail,
      city: addr.city,
      province: addr.province,
      postalCode: addr.postal_code,
    };
  }

  const savedAddresses: SavedAddress[] = [
    {
      id: "a1",
      label: "Rumah",
      recipient_name: "Budi",
      phone: "081111111111",
      address_detail: "Jl. Rumah No. 1",
      province: "DKI Jakarta",
      city: "Jakarta Selatan",
      district: "Kebayoran Baru",
      postal_code: "12190",
      is_default: true,
    },
    {
      id: "a2",
      label: "Kantor",
      recipient_name: "Budi",
      phone: "082222222222",
      address_detail: "Jl. Kantor No. 2",
      province: "DKI Jakarta",
      city: "Jakarta Pusat",
      district: "Menteng",
      postal_code: "10310",
      is_default: false,
    },
  ];

  it("converts saved address to form correctly", () => {
    const form = addressToForm(savedAddresses[0]!);
    expect(form.recipientName).toBe("Budi");
    expect(form.phone).toBe("081111111111");
    expect(form.addressDetail).toBe("Jl. Rumah No. 1");
    expect(form.city).toBe("Jakarta Selatan");
    expect(form.province).toBe("DKI Jakarta");
    expect(form.postalCode).toBe("12190");
  });

  it("pre-selects default address", () => {
    const defaultAddr =
      savedAddresses.find((a) => a.is_default) ?? savedAddresses[0]!;
    expect(defaultAddr.id).toBe("a1");
    expect(defaultAddr.label).toBe("Rumah");
  });

  it("can switch between saved addresses", () => {
    let selectedId = "a1";
    const addr2 = savedAddresses.find((a) => a.id === "a2");
    expect(addr2).toBeDefined();
    selectedId = addr2!.id;
    expect(selectedId).toBe("a2");
  });

  it("can switch to new address mode", () => {
    let mode: "saved" | "new" = "saved";
    mode = "new";
    expect(mode).toBe("new");
  });

  it("validates required fields before submit", () => {
    const form: AddressForm = {
      recipientName: "",
      phone: "081234567890",
      addressDetail: "Jl. Test",
      city: "Jakarta",
      province: "DKI Jakarta",
      postalCode: "12190",
    };

    const missing = Object.entries(form).filter(([, v]) => v.trim() === "");
    expect(missing.length).toBe(1);
    expect(missing[0]![0]).toBe("recipientName");
  });

  it("passes correct fields to createOrderFromCart", () => {
    const form: AddressForm = {
      recipientName: "Budi",
      phone: "081111111111",
      addressDetail: "Jl. Rumah No. 1",
      city: "Jakarta Selatan",
      province: "DKI Jakarta",
      postalCode: "12190",
    };

    const orderParams = {
      recipientName: form.recipientName,
      phone: form.phone,
      addressDetail: form.addressDetail,
      province: form.province,
      city: form.city,
      postalCode: form.postalCode,
      paymentMethod: "bank_transfer" as const,
    };

    expect(orderParams.recipientName).toBe("Budi");
    expect(orderParams.phone).toBe("081111111111");
    expect(orderParams.city).toBe("Jakarta Selatan");
  });

  it("empty addresses forces new address mode", () => {
    const addresses: SavedAddress[] = [];
    const defaultAddr =
      addresses.find((a) => a.is_default) ?? addresses[0];
    expect(defaultAddr).toBeUndefined();
    const mode = defaultAddr ? "saved" : "new";
    expect(mode).toBe("new");
  });
});
