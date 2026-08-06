import { NextRequest, NextResponse } from 'next/server';

const RAW_BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://edutrack.covenantsynergy.in/api';

const BACKEND_URL = RAW_BACKEND_URL.includes('edutrack-saas-backend.fly.dev')
  ? 'https://edutrack.covenantsynergy.in/api'
  : RAW_BACKEND_URL;

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'GET');
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'POST');
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'PUT');
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'PATCH');
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path, 'DELETE');
}

async function proxyRequest(request: NextRequest, pathSegments: string[], method: string) {
  const path = pathSegments.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const cleanBackendUrl = BACKEND_URL.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
  const targetUrl = `${cleanBackendUrl}/${path}${searchParams ? `?${searchParams}` : ''}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const authHeader = request.headers.get('Authorization');
  if (authHeader) headers['Authorization'] = authHeader;

  const tenantHeader = request.headers.get('X-Tenant-ID');
  if (tenantHeader) headers['X-Tenant-ID'] = tenantHeader;

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (method !== 'GET' && method !== 'DELETE') {
    try {
      const body = await request.text();
      if (body) fetchOptions.body = body;
    } catch {
      // no body
    }
  }

  try {
    const backendResponse = await fetch(targetUrl, fetchOptions);
    const responseText = await backendResponse.text();

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    return NextResponse.json(responseData, {
      status: backendResponse.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error(`[Platform Proxy Error] ${method} /${path}:`, error.message);
    return NextResponse.json(
      { message: 'Backend service unavailable. Please try again later.', error: error.message },
      { status: 503 }
    );
  }
}
