public class NamespaceUtils {
    /**
     * Converts a single SObject to a Map, removing any namespace prefixes (__c) from the keys.
     * Useful for Managed Packages where LWC expects un-namespaced field names (e.g. Class__c instead of EduTrack__Class__c)
     */
    public static Map<String, Object> stripNamespace(SObject obj) {
        if (obj == null) return null;
        Map<String, Object> result = new Map<String, Object>();
        Map<String, Object> pop = obj.getPopulatedFieldsAsMap();
        
        for (String key : pop.keySet()) {
            String newKey = key;
            // E.g. EduTrack__Class__c -> Class__c
            if (key.countMatches('__') == 2 && key.endsWith('__c')) {
                newKey = key.substring(key.indexOf('__') + 2);
            } 
            // E.g. EduTrack__Academic_Year__r -> Academic_Year__r
            else if (key.countMatches('__') == 2 && key.endsWith('__r')) {
                newKey = key.substring(key.indexOf('__') + 2);
            }
            
            Object val = pop.get(key);
            if (val instanceof List<Object>) {
                List<Map<String, Object>> childList = new List<Map<String, Object>>();
                for (Object child : (List<Object>)val) {
                    if (child instanceof SObject) {
                        childList.add(stripNamespace((SObject)child));
                    }
                }
                result.put(newKey, childList);
            } else if (val instanceof SObject) {
                result.put(newKey, stripNamespace((SObject)val));
            } else {
                result.put(newKey, val);
            }
        }
        // Always ensure Id is present
        if (obj.Id != null) {
            result.put('Id', obj.Id);
        }
        return result;
    }

    /**
     * Converts a List of SObjects to a List of Maps without namespace prefixes.
     */
    public static List<Map<String, Object>> stripNamespaceList(List<SObject> objs) {
        if (objs == null) return null;
        List<Map<String, Object>> results = new List<Map<String, Object>>();
        for (SObject obj : objs) {
            results.add(stripNamespace(obj));
        }
        return results;
    }

    /**
     * Returns a namespace-aware Visualforce page URL.
     * In a subscriber org (managed package), pages are prefixed with the namespace (EduTrack__).
     * In the dev org, they have no prefix.
     * Usage: NamespaceUtils.getVFPageUrl('AdmissionInvoice', 'id=XXX&preview=true')
     */
    @AuraEnabled(cacheable=false)
    public static String getVFPageUrl(String pageName, String queryParams) {
        String ns = NamespaceUtils.class.getName().replace('NamespaceUtils', '').replace('.', '');
        String prefix = (String.isNotBlank(ns)) ? ns + '__' : '';
        String baseUrl = '/apex/' + prefix + pageName;
        if (String.isNotBlank(queryParams)) {
            baseUrl += '?' + queryParams;
        }
        return baseUrl;
    }
}