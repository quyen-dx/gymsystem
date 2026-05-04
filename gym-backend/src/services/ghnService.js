import axios from 'axios';

const GHN_API_URL = 'https://online-gateway.ghn.vn/shiip/public-api/v2';
const cache = new Map();

const normalizeLocationPart = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const getFallbackShipping = ({ fromAddress, toAddress, totalWeight, total_weight }) => {
    const weightKg = Math.max(0.1, Number(totalWeight || total_weight || 1));
    const fromCity = normalizeLocationPart(fromAddress?.city || fromAddress?.province || process.env.SHOP_CITY || 'Ho Chi Minh');
    const toCity = normalizeLocationPart(toAddress?.city || toAddress?.province);
    const fromDistrict = normalizeLocationPart(fromAddress?.district || process.env.SHOP_DISTRICT);
    const toDistrict = normalizeLocationPart(toAddress?.district);
    const sameCity = fromCity && toCity && fromCity === toCity;
    const sameDistrict = sameCity && fromDistrict && toDistrict && fromDistrict === toDistrict;
    const estimated_days = sameDistrict ? 1 : sameCity ? 2 : 4;
    const baseFee = sameDistrict ? 18000 : sameCity ? 25000 : 38000;
    const shipping_fee = baseFee + Math.ceil(weightKg) * 5000;
    const estimatedDeliveryDate = new Date(Date.now() + estimated_days * 24 * 60 * 60 * 1000);
    const dd = String(estimatedDeliveryDate.getDate()).padStart(2, '0');
    const mm = String(estimatedDeliveryDate.getMonth() + 1).padStart(2, '0');
    const yyyy = estimatedDeliveryDate.getFullYear();
    const estimated_date = `${dd}/${mm}/${yyyy}`;

    return {
        shipping_fee,
        estimated_days,
        estimated_date,
        shippingFee: shipping_fee,
        estimatedDays: estimated_days,
        estimatedDeliveryDate: estimated_date,
        isMock: true,
    };
};

// Helper: Retry function
const fetchWithRetry = async (url, data, config, retries = 2) => {
    try {
        return await axios.post(url, data, config);
    } catch (error) {
        if (retries > 0) {
            console.warn(`GHN API failed (${url}). Retrying... (${retries} left)`);
            return await fetchWithRetry(url, data, config, retries - 1);
        }
        throw error;
    }
};

export const calculateShippingGHN = async (params) => {
    const { to_district_id, to_ward_code, total_weight, toAddress, totalWeight, fromAddress } = params || {};
    
    // We also accept camelCase parameters for backwards compatibility with our system
    const toDistrictId = Number(to_district_id || toAddress?.district_id || 1442);
    const toWardCode = (to_ward_code || toAddress?.ward_code || "20101").toString();
    const weightGram = Math.max(10, Math.ceil((total_weight || totalWeight || 1) * 1000));

    try {
        const token = process.env.GHN_TOKEN;
        const shopId = process.env.GHN_SHOP_ID;
        const fromDistrictId = Number(process.env.GHN_FROM_DISTRICT_ID || 1442);

        // Validate Input
        if (!toDistrictId || !toWardCode || !weightGram) {
            throw new Error('Invalid input parameters');
        }

        if (!token) {
            throw new Error('GHN_TOKEN is missing');
        }

        const cacheKey = `${fromDistrictId}_${toDistrictId}_${toWardCode}_${weightGram}`;
        if (cache.has(cacheKey)) {
            const cachedResult = cache.get(cacheKey);
            if (Date.now() - cachedResult.timestamp < 5 * 60 * 1000) {
                return cachedResult.data;
            }
        }

        const headers = { Token: token };
        if (shopId) headers.ShopId = shopId;

        // BƯỚC 2: Lấy service khả dụng
        const servicesResponse = await fetchWithRetry(
            `${GHN_API_URL}/shipping-order/available-services`,
            {
                shop_id: Number(shopId),
                from_district: fromDistrictId,
                to_district: toDistrictId
            },
            { headers }
        );

        const services = servicesResponse.data?.data || [];
        // Ưu tiên service_type_id = 2 (Chuyển phát chuẩn) hoặc lấy service đầu tiên
        const selectedService = services.find(s => s.service_type_id === 2) || services[0];
        
        if (!selectedService) {
            throw new Error('No available services found for this route');
        }
        const serviceId = selectedService.service_id;

        // BƯỚC 3: Tính phí vận chuyển
        const feeResponse = await fetchWithRetry(
            `${GHN_API_URL}/shipping-order/fee`,
            {
                service_id: serviceId,
                from_district_id: fromDistrictId,
                to_district_id: toDistrictId,
                to_ward_code: toWardCode,
                weight: weightGram
            },
            { headers }
        );

        const shipping_fee = feeResponse.data?.data?.total;
        if (!shipping_fee) throw new Error('GHN API failed to return fee');

        // BƯỚC 4: Tính ngày giao dự kiến
        let estimated_days = 3;
        let estimatedDeliveryDate = new Date(Date.now() + estimated_days * 24 * 60 * 60 * 1000);

        try {
            const leadtimeResponse = await fetchWithRetry(
                `${GHN_API_URL}/shipping-order/leadtime`,
                {
                    from_district_id: fromDistrictId,
                    to_district_id: toDistrictId,
                    to_ward_code: toWardCode,
                    service_id: serviceId
                },
                { headers }
            );
            
            const leadtime = leadtimeResponse.data?.data?.leadtime;
            if (leadtime) {
                estimatedDeliveryDate = new Date(leadtime * 1000);
                estimated_days = Math.ceil((estimatedDeliveryDate - Date.now()) / (1000 * 60 * 60 * 24));
            }
        } catch (leadtimeError) {
             console.warn('GHN Leadtime API failed. Using default leadtime.', leadtimeError.message);
        }

        // Format to DD/MM/YYYY
        const dd = String(estimatedDeliveryDate.getDate()).padStart(2, '0');
        const mm = String(estimatedDeliveryDate.getMonth() + 1).padStart(2, '0');
        const yyyy = estimatedDeliveryDate.getFullYear();
        const estimated_date = `${dd}/${mm}/${yyyy}`;

        const result = {
            shipping_fee,
            estimated_days,
            estimated_date,
            // For backward compatibility with existing project code
            shippingFee: shipping_fee,
            estimatedDays: estimated_days,
            estimatedDeliveryDate: estimated_date
        };

        // Cache result
        cache.set(cacheKey, { data: result, timestamp: Date.now() });

        return result;

    } catch (error) {
        console.error('GHN API Error:', error?.response?.data || error.message);
        
        // BƯỚC 6: Error Handling (Fallback Mode)
        return getFallbackShipping({ fromAddress, toAddress, totalWeight, total_weight });
    }
};
