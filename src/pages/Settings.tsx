import React from 'react';

export const Settings: React.FC = () => {
  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
          <p className="mt-2 text-sm text-slate-700">
            Manage application settings and preferences.
          </p>
        </div>
      </div>

      <div className="mt-8 bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-slate-900">
            Hotel Information
          </h3>
          <div className="mt-2 max-w-xl text-sm text-slate-500">
            <p>Update the hotel's contact information and branding.</p>
          </div>
          <form className="mt-5 sm:flex sm:items-center">
            <div className="w-full sm:max-w-xs">
              <label htmlFor="hotelName" className="sr-only">Hotel Name</label>
              <input
                type="text"
                name="hotelName"
                id="hotelName"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-md border py-2 px-3"
                placeholder="Roameo Resorts & Hotels"
                defaultValue="Roameo Resorts & Hotels"
              />
            </div>
            <button
              type="button"
              className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Save
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
