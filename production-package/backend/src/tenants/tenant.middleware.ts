import { Injectable, NestMiddleware, BadRequestException, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantsService } from './tenants.service';
import { TenantContext } from './tenant.context';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORM_SUBDOMAINS = new Set([
  'www',
  'api',
  'app',
  'localhost',
  'edutrack-frontend-live',
  'edutrack-frontend',
  'edutrack-platform',
  'edu-track-saa-s-orcin',
  'edutrack-saas',
  'edutrack-saas-independent',
]);

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantsService: TenantsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let tenantSubdomain = '';

    // 1. Resolve from X-Tenant-ID header (UUID or Subdomain)
    const headerTenant = req.headers['x-tenant-id'] || req.headers['X-Tenant-ID'];
    if (headerTenant) {
      tenantSubdomain = String(headerTenant).trim();
    } else {
      // 2. Resolve from subdomain of hostname
      const hostname = req.hostname || '';
      
      if (hostname === 'edutrack.covenantsynergy.in' || hostname === 'api-edutrack.covenantsynergy.in') {
        tenantSubdomain = '';
      } else if (hostname.endsWith('.edutrack.covenantsynergy.in')) {
        const parts = hostname.replace('.edutrack.covenantsynergy.in', '').split('.');
        const sub = parts[parts.length - 1];
        if (!PLATFORM_SUBDOMAINS.has(sub)) {
          tenantSubdomain = sub;
        }
      } else if (hostname === 'edutrack.com' || hostname === 'www.edutrack.com' || hostname === 'app.edutrack.com') {
        tenantSubdomain = '';
      } else if (hostname.endsWith('.edutrack.com')) {
        const parts = hostname.replace('.edutrack.com', '').split('.');
        const sub = parts[parts.length - 1];
        if (!PLATFORM_SUBDOMAINS.has(sub)) {
          tenantSubdomain = sub;
        }
      } else if (hostname.endsWith('.vercel.app')) {
        const parts = hostname.replace('.vercel.app', '').split('.');
        if (parts.length > 1 && !PLATFORM_SUBDOMAINS.has(parts[0])) {
          tenantSubdomain = parts[0];
        }
      } else {
        const parts = hostname.split('.');
        if (parts.length > 1 && !PLATFORM_SUBDOMAINS.has(parts[0]) && isNaN(Number(parts[0]))) {
          tenantSubdomain = parts[0];
        }
      }
    }

    // 3. Fallback to query parameter (e.g. ?tenant=school1)
    if (!tenantSubdomain && req.query.tenant) {
      tenantSubdomain = String(req.query.tenant).trim();
    }

    if (!tenantSubdomain || PLATFORM_SUBDOMAINS.has(tenantSubdomain)) {
      // No tenant identifier provided — allow the request through so verified auth can resolve tenant.
      next();
      return;
    }

    const isUuid = UUID_REGEX.test(tenantSubdomain);

    try {
      let tenant;
      if (isUuid) {
        // Direct ID lookup (avoids failing findBySubdomain round-trip)
        tenant = await this.tenantsService.findById(tenantSubdomain);
      } else {
        // Subdomain lookup
        tenant = await this.tenantsService.findBySubdomain(tenantSubdomain);
      }

      TenantContext.run(tenant.id, () => {
        req['tenantId'] = tenant.id;
        next();
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        // If lookup failed, try the alternate resolution method
        try {
          const tenant = isUuid
            ? await this.tenantsService.findBySubdomain(tenantSubdomain)
            : await this.tenantsService.findById(tenantSubdomain);
          TenantContext.run(tenant.id, () => {
            req['tenantId'] = tenant.id;
            next();
          });
          return;
        } catch (e) {
          // If still not found, allow authenticated or public routes to pass without unverified crash
          const isPublicAuthRoute = req.path.startsWith('/auth/') || req.path.startsWith('/tenant/public-branding');
          const hasAuthToken = !!req.headers.authorization;
          if (isPublicAuthRoute || hasAuthToken) {
            next();
            return;
          }
        }
      }
      const isPublicAuthRoute = req.path.startsWith('/auth/') || req.path.startsWith('/tenant/public-branding');
      const hasAuthToken = !!req.headers.authorization;
      if (isPublicAuthRoute || hasAuthToken) {
        next();
        return;
      }
      throw new BadRequestException(`Tenant resolution failed: ${error.message}`);
    }
  }
}
