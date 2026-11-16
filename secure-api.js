/* Keep credentials and payment decisions in authenticated Supabase functions. */
const SecureAPI = (() => {
    async function call(name, body) {
        if (!window.supabaseClient) throw new Error('Service unavailable. Please try again.');
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (!session) throw new Error('Please sign in to continue.');
        const { data, error } = await window.supabaseClient.functions.invoke(name, { body });
        if (error || data?.error) throw new Error(data?.error || 'Service unavailable. Please try again shortly.');
        return data;
    }
    return { call };
})();
