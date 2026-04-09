import { db } from '../firebase';
import { collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';

export const STADIUM_DATA: Record<string, { stadium: string; city: string; state: string }> = {
  "Air Force": { stadium: "Falcon Stadium", city: "Colorado Springs", state: "CO" },
  "Akron": { stadium: "InfoCision Stadium", city: "Akron", state: "OH" },
  "Alabama": { stadium: "Bryant-Denny Stadium", city: "Tuscaloosa", state: "AL" },
  "Appalachian State": { stadium: "Kidd Brewer Stadium", city: "Boone", state: "NC" },
  "Arizona": { stadium: "Arizona Stadium", city: "Tucson", state: "AZ" },
  "Arizona State": { stadium: "Mountain America Stadium", city: "Tempe", state: "AZ" },
  "Arkansas": { stadium: "Donald W. Reynolds Razorback Stadium", city: "Fayetteville", state: "AR" },
  "Arkansas State": { stadium: "Centennial Bank Stadium", city: "Jonesboro", state: "AR" },
  "Army": { stadium: "Michie Stadium", city: "West Point", state: "NY" },
  "Auburn": { stadium: "Jordan-Hare Stadium", city: "Auburn", state: "AL" },
  "Ball State": { stadium: "Scheumann Stadium", city: "Muncie", state: "IN" },
  "Baylor": { stadium: "McLane Stadium", city: "Waco", state: "TX" },
  "Boise State": { stadium: "Albertsons Stadium", city: "Boise", state: "ID" },
  "Boston College": { stadium: "Alumni Stadium", city: "Chestnut Hill", state: "MA" },
  "Bowling Green": { stadium: "Doyt Perry Stadium", city: "Bowling Green", state: "OH" },
  "Buffalo": { stadium: "UB Stadium", city: "Amherst", state: "NY" },
  "BYU": { stadium: "LaVell Edwards Stadium", city: "Provo", state: "UT" },
  "California": { stadium: "California Memorial Stadium", city: "Berkeley", state: "CA" },
  "Central Michigan": { stadium: "Kelly/Shorts Stadium", city: "Mount Pleasant", state: "MI" },
  "Charlotte": { stadium: "Jerry Richardson Memorial Stadium", city: "Charlotte", state: "NC" },
  "Cincinnati": { stadium: "Nippert Stadium", city: "Cincinnati", state: "OH" },
  "Clemson": { stadium: "Memorial Stadium", city: "Clemson", state: "SC" },
  "Coastal Carolina": { stadium: "Brooks Stadium", city: "Conway", state: "SC" },
  "Colorado": { stadium: "Folsom Field", city: "Boulder", state: "CO" },
  "Colorado State": { stadium: "Canvas Stadium", city: "Fort Collins", state: "CO" },
  "Delaware": { stadium: "Delaware Stadium", city: "Newark", state: "DE" },
  "Duke": { stadium: "Wallace Wade Stadium", city: "Durham", state: "NC" },
  "East Carolina": { stadium: "Dowdy-Ficklen Stadium", city: "Greenville", state: "NC" },
  "Eastern Michigan": { stadium: "Rynearson Stadium", city: "Ypsilanti", state: "MI" },
  "Florida": { stadium: "Ben Hill Griffin Stadium", city: "Gainesville", state: "FL" },
  "Florida Atlantic": { stadium: "FAU Stadium", city: "Boca Raton", state: "FL" },
  "Florida International": { stadium: "FIU Stadium", city: "Miami", state: "FL" },
  "Florida State": { stadium: "Doak Campbell Stadium", city: "Tallahassee", state: "FL" },
  "Fresno State": { stadium: "Valley Children's Stadium", city: "Fresno", state: "CA" },
  "Georgia": { stadium: "Sanford Stadium", city: "Athens", state: "GA" },
  "Georgia Southern": { stadium: "Paulson Stadium", city: "Statesboro", state: "GA" },
  "Georgia State": { stadium: "Center Parc Stadium", city: "Atlanta", state: "GA" },
  "Georgia Tech": { stadium: "Bobby Dodd Stadium", city: "Atlanta", state: "GA" },
  "Hawaii": { stadium: "Clarence T.C. Ching Athletics Complex", city: "Honolulu", state: "HI" },
  "Houston": { stadium: "TDECU Stadium", city: "Houston", state: "TX" },
  "Illinois": { stadium: "Memorial Stadium", city: "Champaign", state: "IL" },
  "Indiana": { stadium: "Memorial Stadium", city: "Bloomington", state: "IN" },
  "Iowa": { stadium: "Kinnick Stadium", city: "Iowa City", state: "IA" },
  "Iowa State": { stadium: "Jack Trice Stadium", city: "Ames", state: "IA" },
  "Jacksonville State": { stadium: "Burgess-Snow Field", city: "Jacksonville", state: "AL" },
  "James Madison": { stadium: "Bridgeforth Stadium", city: "Harrisonburg", state: "VA" },
  "Kansas": { stadium: "David Booth Kansas Memorial Stadium", city: "Lawrence", state: "KS" },
  "Kansas State": { stadium: "Bill Snyder Family Stadium", city: "Manhattan", state: "KS" },
  "Kennesaw State": { stadium: "Fifth Third Stadium", city: "Kennesaw", state: "GA" },
  "Kent State": { stadium: "Dix Stadium", city: "Kent", state: "OH" },
  "Kentucky": { stadium: "Kroger Field", city: "Lexington", state: "KY" },
  "Liberty": { stadium: "Williams Stadium", city: "Lynchburg", state: "VA" },
  "LSU": { stadium: "Tiger Stadium", city: "Baton Rouge", state: "LA" },
  "Louisiana": { stadium: "Cajun Field", city: "Lafayette", state: "LA" },
  "Louisiana Tech": { stadium: "Joe Aillet Stadium", city: "Ruston", state: "LA" },
  "Louisville": { stadium: "L&N Federal Credit Union Stadium", city: "Louisville", state: "KY" },
  "Marshall": { stadium: "Joan C. Edwards Stadium", city: "Huntington", state: "WV" },
  "Maryland": { stadium: "SECU Stadium", city: "College Park", state: "MD" },
  "Memphis": { stadium: "Simmons Bank Liberty Stadium", city: "Memphis", state: "TN" },
  "Miami (FL)": { stadium: "Hard Rock Stadium", city: "Miami Gardens", state: "FL" },
  "Miami (OH)": { stadium: "Yager Stadium", city: "Oxford", state: "OH" },
  "Michigan": { stadium: "Michigan Stadium", city: "Ann Arbor", state: "MI" },
  "Michigan State": { stadium: "Spartan Stadium", city: "East Lansing", state: "MI" },
  "Middle Tennessee": { stadium: "Johnny \"Red\" Floyd Stadium", city: "Murfreesboro", state: "TN" },
  "Minnesota": { stadium: "Huntington Bank Stadium", city: "Minneapolis", state: "MN" },
  "Mississippi State": { stadium: "Davis Wade Stadium", city: "Starkville", state: "MS" },
  "Missouri": { stadium: "Faurot Field", city: "Columbia", state: "MO" },
  "Missouri State": { stadium: "Robert W. Plaster Stadium", city: "Springfield", state: "MO" },
  "Navy": { stadium: "Navy-Marine Corps Memorial Stadium", city: "Annapolis", state: "MD" },
  "NC State": { stadium: "Carter-Finley Stadium", city: "Raleigh", state: "NC" },
  "Nebraska": { stadium: "Memorial Stadium", city: "Lincoln", state: "NE" },
  "Nevada": { stadium: "Mackay Stadium", city: "Reno", state: "NV" },
  "New Mexico": { stadium: "University Stadium", city: "Albuquerque", state: "NM" },
  "New Mexico State": { stadium: "Aggie Memorial Stadium", city: "Las Cruces", state: "NM" },
  "North Carolina": { stadium: "Kenan Memorial Stadium", city: "Chapel Hill", state: "NC" },
  "North Texas": { stadium: "DATCU Stadium", city: "Denton", state: "TX" },
  "Northern Illinois": { stadium: "Huskie Stadium", city: "DeKalb", state: "IL" },
  "Northwestern": { stadium: "Ryan Field", city: "Evanston", state: "IL" },
  "Notre Dame": { stadium: "Notre Dame Stadium", city: "Notre Dame", state: "IN" },
  "Ohio": { stadium: "Peden Stadium", city: "Athens", state: "OH" },
  "Ohio State": { stadium: "Ohio Stadium", city: "Columbus", state: "OH" },
  "Oklahoma": { stadium: "Gaylord Family Oklahoma Memorial Stadium", city: "Norman", state: "OK" },
  "Oklahoma State": { stadium: "Boone Pickens Stadium", city: "Stillwater", state: "OK" },
  "Old Dominion": { stadium: "S.B. Ballard Stadium", city: "Norfolk", state: "VA" },
  "Ole Miss": { stadium: "Vaught-Hemingway Stadium", city: "Oxford", state: "MS" },
  "Oregon": { stadium: "Autzen Stadium", city: "Eugene", state: "OR" },
  "Oregon State": { stadium: "Reser Stadium", city: "Corvallis", state: "OR" },
  "Penn State": { stadium: "Beaver Stadium", city: "University Park", state: "PA" },
  "Pittsburgh": { stadium: "Acrisure Stadium", city: "Pittsburgh", state: "PA" },
  "Purdue": { stadium: "Ross-Ade Stadium", city: "West Lafayette", state: "IN" },
  "Rice": { stadium: "Rice Stadium", city: "Houston", state: "TX" },
  "Rutgers": { stadium: "SHI Stadium", city: "Piscataway", state: "NJ" },
  "Sam Houston": { stadium: "Elliott T. Bowers Stadium", city: "Huntsville", state: "TX" },
  "San Diego State": { stadium: "Snapdragon Stadium", city: "San Diego", state: "CA" },
  "San Jose State": { stadium: "CEFCU Stadium", city: "San Jose", state: "CA" },
  "SMU": { stadium: "Gerald J. Ford Stadium", city: "Dallas", state: "TX" },
  "South Alabama": { stadium: "Hancock Whitney Stadium", city: "Mobile", state: "AL" },
  "South Carolina": { stadium: "Williams-Brice Stadium", city: "Columbia", state: "SC" },
  "South Florida": { stadium: "Raymond James Stadium", city: "Tampa", state: "FL" },
  "Southern Miss": { stadium: "M. M. Roberts Stadium", city: "Hattiesburg", state: "MS" },
  "Stanford": { stadium: "Stanford Stadium", city: "Stanford", state: "CA" },
  "Syracuse": { stadium: "JMA Wireless Dome", city: "Syracuse", state: "NY" },
  "TCU": { stadium: "Amon G. Carter Stadium", city: "Fort Worth", state: "TX" },
  "Temple": { stadium: "Lincoln Financial Field", city: "Philadelphia", state: "PA" },
  "Tennessee": { stadium: "Neyland Stadium", city: "Knoxville", state: "TN" },
  "Texas": { stadium: "Darrell K Royal-Texas Memorial Stadium", city: "Austin", state: "TX" },
  "Texas A&M": { stadium: "Kyle Field", city: "College Station", state: "TX" },
  "Texas State": { stadium: "Jim Wacker Field at Bobcat Stadium", city: "San Marcos", state: "TX" },
  "Texas Tech": { stadium: "Jones AT&T Stadium", city: "Lubbock", state: "TX" },
  "Toledo": { stadium: "Glass Bowl", city: "Toledo", state: "OH" },
  "Troy": { stadium: "Veterans Memorial Stadium", city: "Troy", state: "AL" },
  "Tulane": { stadium: "Yulman Stadium", city: "New Orleans", state: "LA" },
  "Tulsa": { stadium: "H.A. Chapman Stadium", city: "Tulsa", state: "OK" },
  "UAB": { stadium: "Protective Stadium", city: "Birmingham", state: "AL" },
  "UCF": { stadium: "FBC Mortgage Stadium", city: "Orlando", state: "FL" },
  "UCLA": { stadium: "Rose Bowl", city: "Pasadena", state: "CA" },
  "UConn": { stadium: "Pratt & Whitney Stadium at Rentschler Field", city: "East Hartford", state: "CT" },
  "UMass": { stadium: "McGuirk Alumni Stadium", city: "Amherst", state: "MA" },
  "UNLV": { stadium: "Allegiant Stadium", city: "Las Vegas", state: "NV" },
  "USC": { stadium: "Los Angeles Memorial Coliseum", city: "Los Angeles", state: "CA" },
  "Utah": { stadium: "Rice-Eccles Stadium", city: "Salt Lake City", state: "UT" },
  "Utah State": { stadium: "Maverik Stadium", city: "Logan", state: "UT" },
  "UTEP": { stadium: "Sun Bowl", city: "El Paso", state: "TX" },
  "UTSA": { stadium: "Alamodome", city: "San Antonio", state: "TX" },
  "Vanderbilt": { stadium: "FirstBank Stadium", city: "Nashville", state: "TN" },
  "Virginia": { stadium: "Scott Stadium", city: "Charlottesville", state: "VA" },
  "Virginia Tech": { stadium: "Lane Stadium", city: "Blacksburg", state: "VA" },
  "Wake Forest": { stadium: "Allegacy Federal Credit Union Stadium", city: "Winston-Salem", state: "NC" },
  "Washington": { stadium: "Husky Stadium", city: "Seattle", state: "WA" },
  "Washington State": { stadium: "Gesa Field at Martin Stadium", city: "Pullman", state: "WA" },
  "West Virginia": { stadium: "Milan Puskar Stadium", city: "Morgantown", state: "WV" },
  "Western Kentucky": { stadium: "Houchens Industries-L. T. Smith Stadium", city: "Bowling Green", state: "KY" },
  "Western Michigan": { stadium: "Waldo Stadium", city: "Kalamazoo", state: "MI" },
  "Wisconsin": { stadium: "Camp Randall Stadium", city: "Madison", state: "WI" },
  "Wyoming": { stadium: "War Memorial Stadium", city: "Laramie", state: "WY" }
};

export const enrichTeamsWithStadiums = async (leagueId: string) => {
  if (!leagueId) throw new Error('League ID is required for enrichment');
  
  console.log(`[Enrichment] Starting for league: ${leagueId}...`);
  console.log(`[Enrichment] STADIUM_DATA keys count: ${Object.keys(STADIUM_DATA).length}`);
  try {
    const teamsRef = collection(db, 'leagues', leagueId, 'teams');
    console.log(`[Enrichment] Fetching teams from: leagues/${leagueId}/teams`);
    const snapshot = await getDocs(teamsRef);
    
    console.log(`[Enrichment] Found ${snapshot.size} teams in Firestore.`);
    
    if (snapshot.empty) {
      console.warn('[Enrichment] No teams found in this league.');
      return 0;
    }

    const batch = writeBatch(db);
    let count = 0;
    let skipped = 0;

    snapshot.docs.forEach((teamDoc) => {
      const teamData = teamDoc.data();
      const teamName = (teamData.name || teamData.school || '').trim();
      
      if (!teamName) {
        console.warn(`[Enrichment] Team ${teamDoc.id} has no name or school field.`);
        skipped++;
        return;
      }

      // Case-insensitive lookup with trimming
      const matchKey = Object.keys(STADIUM_DATA).find(key => 
        key.toLowerCase().trim() === teamName.toLowerCase()
      );

      if (matchKey) {
        const info = STADIUM_DATA[matchKey];
        console.log(`[Enrichment] Queuing update for ${teamName} (${teamDoc.id})`);
        
        batch.update(doc(db, 'leagues', leagueId, 'teams', teamDoc.id), {
          stadiumName: info.stadium,
          city: info.city,
          state: info.state,
          updatedAt: serverTimestamp()
        });
        count++;
      } else {
        console.log(`[Enrichment] No match for "${teamName}"`);
        skipped++;
      }
    });
    
    if (count > 0) {
      console.log(`[Enrichment] Committing batch of ${count} updates...`);
      await batch.commit();
      console.log('[Enrichment] Batch commit successful.');
    } else {
      console.log('[Enrichment] No updates to commit.');
    }
    
    console.log(`[Enrichment] Complete. Success: ${count}, Skipped: ${skipped}`);
    return count;
  } catch (error) {
    console.error('[Enrichment] Critical error:', error);
    throw error;
  }
};
