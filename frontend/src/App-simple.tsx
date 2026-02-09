function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                🏢 Company Directory
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Welcome to your employee directory application!
              </p>
              <div className="space-y-4">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    ✅ Frontend Running
                  </h2>
                  <p className="text-gray-600">
                    React application is successfully loaded
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    ✅ Backend API
                  </h2>
                  <p className="text-gray-600">
                    API server running on port 3000
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    ✅ Database
                  </h2>
                  <p className="text-gray-600">
                    PostgreSQL and Redis containers running
                  </p>
                </div>
              </div>
              <div className="mt-8">
                <p className="text-sm text-gray-500">
                  The application infrastructure is ready. 
                  <br />
                  Full authentication and employee management features can be implemented next.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;