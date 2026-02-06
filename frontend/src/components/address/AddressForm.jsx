import { useState, useEffect } from 'react';
import {
  regions,
  provinces,
  cities,
  barangays
} from 'select-philippines-address';
import COUNTRIES from './countries';

const AddressForm = ({ register, errors, setValue, watch, prefix = '' }) => {
  const p = (field) => prefix ? `${prefix}.${field}` : field;
  const getError = (field) => {
    if (!prefix) return errors[field];
    return prefix.split('.').reduce((obj, key) => obj?.[key], errors)?.[field];
  };

  const country = watch(p('country')) || 'Philippines';
  const isPH = country === 'Philippines';

  // PSGC dropdown data
  const [regionList, setRegionList] = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [barangayList, setBarangayList] = useState([]);

  // Selected codes for cascading
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Load regions on mount
  useEffect(() => {
    if (isPH) {
      regions().then(setRegionList);
    }
  }, [isPH]);

  // Load provinces when region changes
  useEffect(() => {
    if (selectedRegion) {
      provinces(selectedRegion).then(setProvinceList);
      setSelectedProvince('');
      setSelectedCity('');
      setCityList([]);
      setBarangayList([]);
      setValue(p('province'), '');
      setValue(p('city'), '');
      setValue(p('barangay'), '');
    }
  }, [selectedRegion]);

  // Load cities when province changes
  useEffect(() => {
    if (selectedProvince) {
      cities(selectedProvince).then(setCityList);
      setSelectedCity('');
      setBarangayList([]);
      setValue(p('city'), '');
      setValue(p('barangay'), '');
    }
  }, [selectedProvince]);

  // Load barangays when city changes
  useEffect(() => {
    if (selectedCity) {
      barangays(selectedCity).then(setBarangayList);
      setValue(p('barangay'), '');
    }
  }, [selectedCity]);

  // Reset address fields when country changes
  const handleCountryChange = (val) => {
    setValue(p('country'), val);
    setValue(p('region'), '');
    setValue(p('province'), '');
    setValue(p('city'), '');
    setValue(p('barangay'), '');
    setValue(p('zipCode'), '');
    setValue(p('address'), '');
    setSelectedRegion('');
    setSelectedProvince('');
    setSelectedCity('');
    setProvinceList([]);
    setCityList([]);
    setBarangayList([]);
  };

  return (
    <div className="space-y-4">
      {/* Country */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Country <span className="text-red-500">*</span>
        </label>
        <select
          {...register(p('country'), { required: 'Country is required' })}
          onChange={(e) => {
            handleCountryChange(e.target.value);
          }}
          className="input-field"
        >
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {getError('country') && (
          <p className="text-red-600 text-sm mt-1">{getError('country').message}</p>
        )}
      </div>

      {isPH ? (
        <>
          {/* Region */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Region <span className="text-red-500">*</span>
            </label>
            <select
              {...register(p('region'), { required: 'Region is required' })}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setValue(p('region'), e.target.value);
              }}
              className="input-field"
            >
              <option value="">Select Region</option>
              {regionList.map((region) => (
                <option key={region.region_code} value={region.region_code}>
                  {region.region_name}
                </option>
              ))}
            </select>
            {getError('region') && (
              <p className="text-red-600 text-sm mt-1">{getError('region').message}</p>
            )}
          </div>

          {/* Province */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Province <span className="text-red-500">*</span>
            </label>
            <select
              {...register(p('province'), { required: 'Province is required' })}
              onChange={(e) => {
                setSelectedProvince(e.target.value);
                setValue(p('province'), e.target.value);
              }}
              disabled={!selectedRegion}
              className="input-field disabled:bg-gray-100"
            >
              <option value="">Select Province</option>
              {provinceList.map((province) => (
                <option key={province.province_code} value={province.province_code}>
                  {province.province_name}
                </option>
              ))}
            </select>
            {getError('province') && (
              <p className="text-red-600 text-sm mt-1">{getError('province').message}</p>
            )}
          </div>

          {/* City/Municipality */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City/Municipality <span className="text-red-500">*</span>
            </label>
            <select
              {...register(p('city'), { required: 'City is required' })}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                setValue(p('city'), e.target.value);
              }}
              disabled={!selectedProvince}
              className="input-field disabled:bg-gray-100"
            >
              <option value="">Select City/Municipality</option>
              {cityList.map((city) => (
                <option key={city.city_code} value={city.city_code}>
                  {city.city_name}
                </option>
              ))}
            </select>
            {getError('city') && (
              <p className="text-red-600 text-sm mt-1">{getError('city').message}</p>
            )}
          </div>

          {/* Barangay & ZIP Code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Barangay <span className="text-red-500">*</span>
              </label>
              <select
                {...register(p('barangay'), { required: 'Barangay is required' })}
                disabled={!selectedCity}
                className="input-field disabled:bg-gray-100"
              >
                <option value="">Select Barangay</option>
                {barangayList.map((brgy) => (
                  <option key={brgy.brgy_code} value={brgy.brgy_name}>
                    {brgy.brgy_name}
                  </option>
                ))}
              </select>
              {getError('barangay') && (
                <p className="text-red-600 text-sm mt-1">{getError('barangay').message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ZIP Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 1234"
                {...register(p('zipCode'), {
                  required: 'ZIP code is required',
                  pattern: {
                    value: /^\d{4}$/,
                    message: 'Please enter a valid 4-digit ZIP code'
                  }
                })}
                className="input-field"
              />
              {getError('zipCode') && (
                <p className="text-red-600 text-sm mt-1">{getError('zipCode').message}</p>
              )}
            </div>
          </div>

          {/* Street Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              House/Unit No., Street <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. 123 Rizal St."
              {...register(p('address'), { required: 'Street address is required' })}
              className="input-field"
            />
            {getError('address') && (
              <p className="text-red-600 text-sm mt-1">{getError('address').message}</p>
            )}
          </div>
        </>
      ) : (
        <>
          {/* International: State/Province */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              State/Province <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="State or Province"
              {...register(p('province'), { required: 'State/Province is required' })}
              className="input-field"
            />
            {getError('province') && (
              <p className="text-red-600 text-sm mt-1">{getError('province').message}</p>
            )}
          </div>

          {/* International: City */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="City"
              {...register(p('city'), { required: 'City is required' })}
              className="input-field"
            />
            {getError('city') && (
              <p className="text-red-600 text-sm mt-1">{getError('city').message}</p>
            )}
          </div>

          {/* International: Postal Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Postal Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Postal Code"
              {...register(p('zipCode'), { required: 'Postal code is required' })}
              className="input-field"
            />
            {getError('zipCode') && (
              <p className="text-red-600 text-sm mt-1">{getError('zipCode').message}</p>
            )}
          </div>

          {/* International: Street Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Street Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Full street address"
              {...register(p('address'), { required: 'Street address is required' })}
              className="input-field"
            />
            {getError('address') && (
              <p className="text-red-600 text-sm mt-1">{getError('address').message}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AddressForm;
