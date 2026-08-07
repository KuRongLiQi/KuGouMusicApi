// 听歌识曲
const axios = require('axios');

const DEFAULT_FALLBACK_URL = 'https://kugoumusicapi.vercel.app/audio/match';

const createPrimaryRequest = (params, useAxios) => {
  const paramsMap = {
    fpid: Date.now(),
    area_code: 1,
    include_unpublish: 1,
    useid: params?.userid || params?.cookie?.userid || 0,
    multi_result: 1,
  };

  return useAxios({
    url: '/fingerprint.service/v1/music_trackid_mulit',
    encryptType: 'android',
    method: 'POST',
    data: params.data,
    params: paramsMap,
    cookie: params?.cookie || {},
    headers: { 'content-type': 'application/octet-stream', 'user-agent': 'KuGou/11490 (Android)' },
  });
};

const fallbackUrl = () => {
  const configured = String(process.env.AUDIO_MATCH_FALLBACK_URL || '').trim();
  return configured || DEFAULT_FALLBACK_URL;
};

const normalizedErrorMessage = (error) => {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const body = error.body;
    if (body && typeof body === 'object') {
      const message = body.msg || body.message || body.error;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
  }
  return 'Audio recognition upstream request failed';
};

module.exports = async (params, useAxios) => {
  try {
    return await createPrimaryRequest(params, useAxios);
  } catch (primaryError) {
    const url = fallbackUrl();
    if (!url || !Buffer.isBuffer(params.data) || params.data.length === 0) {
      throw primaryError;
    }

    console.warn(`[audio/match] Primary upstream failed, retrying fallback: ${normalizedErrorMessage(primaryError)}`);
    try {
      const response = await axios.post(url, params.data, {
        headers: { 'content-type': 'application/octet-stream' },
        timeout: 30000,
      });
      return {
        status: response.status,
        body: response.data,
        cookie: [],
        headers: {},
      };
    } catch (fallbackError) {
      throw {
        status: 502,
        body: {
          status: 0,
          error_code: 502,
          msg: `Audio recognition fallback failed: ${normalizedErrorMessage(fallbackError)}`,
        },
        cookie: [],
        headers: {},
      };
    }
  }
};
