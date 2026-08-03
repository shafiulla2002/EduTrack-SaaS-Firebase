import { SetMetadata } from '@nestjs/common';

export const FEATURE_KEY = 'required_feature';
export const RequiresFeature = (feature: string) => SetMetadata(FEATURE_KEY, feature);
