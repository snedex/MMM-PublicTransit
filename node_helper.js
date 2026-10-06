const NodeHelper = require("node_helper");
const { URL } = require("url");

module.exports = NodeHelper.create({
  async socketNotificationReceived(notification, payload) {
    
    console.log("[DEBUG] activeHours: " + JSON.stringify(payload.activeHours));
    
    if (!payload.activeHours) { //This feels wrong
      console.log("Active hours not defined, skipping API Calls.");
      return;
    }

    if (notification === "FETCH_BUS_SCHEDULE") {
      try {

        const baseUrl = `https://external.transitapp.com/${payload.api_version}/public/stop_departures`;
        const url = new URL(baseUrl);

        url.searchParams.append('global_stop_ids', payload.global_stop_ids);
        url.searchParams.append('remove_cancelled', payload.remove_cancelled);
        url.searchParams.append('max_num_departures', payload.max_num_departures);
        url.searchParams.append('locale', payload.locale);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'apiKey': payload.apiKey,
            'Accept-Language': 'en'
          }
        });

        if (!response.ok) {
          throw new Error(`API request failed with status: ${response.status}`);
        }

        const data = await response.json();
        const routeDepartures = data.route_departures;

        if (!routeDepartures || !Array.isArray(routeDepartures)) {
          throw new Error(`API request returned invalid routeDepartures: ${JSON.stringify(data)}`);
        }

        const result = [];

        routeDepartures.forEach(route => {
          if (!route.merged_itineraries || !Array.isArray(route.merged_itineraries)) return;
          
          route.merged_itineraries.forEach(mergedItinerary => {
              if (!mergedItinerary.schedule_items || !Array.isArray(mergedItinerary.schedule_items)) return;
              
              mergedItinerary.schedule_items.forEach(scheduleItem => {
                
                const itinerary = mergedItinerary.itineraries.find(item => 
                  item.internal_itinerary_id === scheduleItem.internal_itinerary_id);

                result.push({
                  global_stop_id: route.global_stop_id,
                  stop_name: mergedItinerary.closest_stop.stop_name,
                  route_short_name: route.route_short_name, 
                  trip_headsign: itinerary.merged_headsign,
                  departure_time: scheduleItem.scheduled_departure_time,
                  route_id: route.real_time_route_id
                });

              });
          });
        });

        for (const stopId of stopIds) {
          
          const data = await response.json();
          const routeDepartures = data.route_departures;
          const stop = data.stop;
          const stopName = stop ? stop.name : stopId;
        
          if (routeDepartures && Array.isArray(routeDepartures)) {
            routeDepartures.forEach(route => {
              if (route.itineraries && Array.isArray(route.itineraries)) {
                route.itineraries.forEach(itinerary => {
                  if (itinerary.schedule_items && Array.isArray(itinerary.schedule_items)) {
                    itinerary.schedule_items.forEach(scheduleItem => {
                        
                        // Push all available data to the frontend including stop info
                        result.push({
                          global_stop_id: stopId,
                          stop_name: stopName,
                          route_short_name: route.route_short_name, 
                          trip_headsign: itinerary.headsign,
                          departure_time: scheduleItem.departure_time,
                          route_id: route.real_time_route_id
                        });

                    });
                  }
                });
              }
            });
          }
        }

        // Sort the result by departure_time
        result.sort((a, b) => a.departure_time - b.departure_time);
        this.sendSocketNotification("UPDATE_BUS_SCHEDULE", result);
  
      } catch (error) {
        console.error('Error fetching bus times:', error);
      }
    }
  },
});

