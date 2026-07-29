import { Injectable, NestMiddleware, BadRequestException, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantsService } from './tenants.service';
import { TenantContext } from './tenant.context';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantsService: TenantsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    let tenantSubdomain = '';

    // 1. Resolve from X-Tenant-ID header (highly reliable for SPA client REST API calls)
    const headerTenant = req.headers['x-tenant-id'] || req.headers['X-Tenant-ID'];
    if (headerTenant) {
      tenantSubdomain = String(headerTenant).trim();
    } else {
      // 2. Resolve from subdomain of hostname
      const hostname = req.hostname;
      
      if (hostname === 'edutrack.covenantsynergy.in' || hostname === 'api-edutrack.covenantsynergy.in') {
        tenantSubdomain = '';
      } else if (hostname.endsWith('.edutrack.covenantsynergy.in')) {
        const parts = hostname.replace('.edutrack.covenantsynergy.in', '').split('.');
        const sub = parts[parts.length - 1];
        if (sub !== 'www' && sub !== 'api') {
          tenantSubdomain = sub;
        }
      } else if (hostname === 'edutrack.com' || hostname === 'www.edutrack.com' || hostname === 'app.edutrack.com') {
        tenantSubdomain = '';
      } else if (hostname.endsWith('.edutrack.com')) {
        const parts = hostname.replace('.edutrack.com', '').split('.');
        const sub = parts[parts.length - 1];
        if (sub !== 'www' && sub !== 'api' && sub !== 'app') {
          tenantSubdomain = sub;
        }
      } else if (hostname.endsWith('.vercel.app')) {
        const parts = hostname.replace('.vercel.app', '').split('.');
        if (parts.length > 1 && parts[0] !== 'www') {
          tenantSubdomain = parts[0];
        }
      } else {
        const parts = hostname.split('.');
        if (parts.length > 1 && parts[0] !== 'localhost' && parts[0] !== 'www' && isNaN(Number(parts[0]))) {
          tenantSubdomain = parts[0];
        }
      }
    }

    // 3. Fallback to query parameter (e.g. ?tenant=school1)
    if (!tenantSubdomain && req.query.tenant) {
      tenantSubdomain = String(req.query.tenant).trim();
    }

    if (!tenantSubdomain) {
      // No tenant identifier provided — allow the request through without a tenant context.
      next();
      return;
    }

    try {
      // Search by subdomain
      const tenant = await this.tenantsService.findBySubdomain(tenantSubdomain);
      TenantContext.run(tenant.id, () => {
        req['tenantId'] = tenant.id;
        next();
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        // If not found as subdomain, try if it was a raw UUID ID
        try {
          const tenant = await this.tenantsService.findById(tenantSubdomain);
          TenantContext.run(tenant.id, () => {
            req['tenantId'] = tenant.id;
            next();
          });
          return;
        } catch (e) {
          // If still not found, allow public auth routes to continue gracefully without blocking
          const isPublicAuthRoute = req.path.startsWith('/auth/') || req.path.startsWith('/tenant/public-branding');
          if (isPublicAuthRoute) {
            next();
            return;
          }
        }
      }
      const isPublicAuthRoute = req.path.startsWith('/auth/') || req.path.startsWith('/tenant/public-branding');
      if (isPublicAuthRoute) {
        next();
        return;
      }
      throw new BadRequestException(`Tenant resolution failed: ${error.message}`);
    }
  }
}
