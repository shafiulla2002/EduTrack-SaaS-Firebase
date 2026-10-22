public class NamespaceUtils {
    /**
     * Converts a single SObject to a Map, removing any namespace prefixes (__c) from the keys.
     * Useful for Managed Packages where LWC expects un-namespaced field names (e.g. Class__c instead of EduTrack__Class__c)
     */
    public static Map<String, Object> stripNamespace(SObject obj) {
        if (obj == null) return null;
        Map<String, Object> result = new Map<String, Object>();
        Map<String, Object> pop = obj.getPopulatedFieldsAsMap();
        String ns = getNamespace();
        
        for (String key : pop.keySet()) {
            String newKey = key;
            if (String.isNotBlank(ns) && newKey.startsWith(ns)) {
                newKey = newKey.substring(ns.length());
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

    /**
     * Returns the current namespace prefix (e.g. "EduTrack__").
     * Returns empty string if no namespace.
     */
    public static String getNamespace() {
        String name = NamespaceUtils.class.getName();
        if (name.contains('.')) {
            return name.substringBefore('.') + '__';
        }
        return '';
    }

    /**
     * Prepends the namespace to a field name if it's not already namespaced.
     */
    public static String withNamespace(String fieldName) {
        if (String.isBlank(fieldName)) return fieldName;
        if (fieldName.contains('__')) return fieldName; 
        return getNamespace() + fieldName;
    }

    /**
     * Injects the namespace into a SOQL query string for all custom fields/objects.
     */
    public static String addNamespaceToQuery(String query) {
        String ns = getNamespace();
        if (String.isBlank(ns)) return query;
        // Matches custom fields/objects (ending in __c or __r) that don't already have a namespace
        // e.g. "Class__c" -> "EduTrack__Class__c"
        // e.g. "Account.Class__r.Name" -> "Account.EduTrack__Class__r.Name"
        return query.replaceAll('(?<![a-zA-Z0-9_])([a-zA-Z0-9_]+__c\\b)', ns + '$1')
                    .replaceAll('(?<![a-zA-Z0-9_])([a-zA-Z0-9_]+__r\\b)', ns + '$1');
    }
    /**
     * Safely retrieves a field value from an SObject's populated fields map.
     * Prevents SObjectException if a field was stripped by Security.stripInaccessible().
     * Handles both namespaced and un-namespaced keys.
     */
    public static Object getValue(SObject obj, String fieldName) {
        if (obj == null || String.isBlank(fieldName)) return null;
        
        if (fieldName.contains('.')) {
            String firstPart = fieldName.substringBefore('.');
            String rest = fieldName.substringAfter('.');
            Object parent = getValue(obj, firstPart);
            if (parent instanceof SObject) {
                return getValue((SObject)parent, rest);
            }
            return null;
        }

        Map<String, Object> populated = obj.getPopulatedFieldsAsMap();
        String target = fieldName.toLowerCase();
        for (String key : populated.keySet()) {
            if (key.toLowerCase() == target) return populated.get(key);
        }
        
        String nsPrefix = getNamespace().toLowerCase();
        if (String.isNotBlank(nsPrefix) && !target.startsWith(nsPrefix)) {
            String nsTarget = nsPrefix + target;
            for (String key : populated.keySet()) {
                if (key.toLowerCase() == nsTarget) return populated.get(key);
            }
        }
        
        if (!target.startsWith('edutrack__')) {
            String etTarget = 'edutrack__' + target;
            for (String key : populated.keySet()) {
                if (key.toLowerCase() == etTarget) return populated.get(key);
            }
        }
        
        return null;
    }
}


