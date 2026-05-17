import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      associatedApplications: [
        {
          applicationId: "377aa8a2-24d1-4d6e-8eca-e347864c9880",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
